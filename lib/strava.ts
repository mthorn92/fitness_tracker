import { shiftIsoDate } from "@/lib/format";
import { readActivityCache, readRunCache, readStravaToken, writeActivityCache, writeRunCache, writeStravaToken } from "@/lib/strava-store";
import {
  cacheIsFresh,
  mondayOnOrBefore,
  modelFromRuns,
  parseTokenResponse,
  type RawRun,
  type StravaTileModel,
} from "@/lib/strava-summary";
import {
  activitiesToRuns,
  modelFromActivities,
  parseAllActivities,
  type CachedActivity,
  type StravaWorkoutsModel,
} from "@/lib/strava-workouts";

const TOKEN_URL = "https://www.strava.com/oauth/token";
const ACTIVITIES_URL = "https://www.strava.com/api/v3/athlete/activities";

type Creds = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
};

let chain: Promise<unknown> = Promise.resolve();
/** After a failed Strava call, skip the network until this time. */
let backoffUntilMs = 0;
let backoffCode = "strava_429";

/**
 * Runs for the exercise tile.
 * With no Strava env vars (and no saved refresh token) this is the disconnected state.
 * Tokens stay on the server. Failures are generic status codes, never response bodies.
 */
export function getStravaSummary(today: string): Promise<StravaTileModel> {
  return enqueue(() => loadFeed(today).then((feed) => summaryFromFeed(feed, today)));
}

/** Every Strava sport for the last-7-days tile. Shares the run tile's fetch and cache. */
export function getStravaWorkouts(today: string): Promise<StravaWorkoutsModel> {
  return enqueue(() => loadFeed(today).then((feed) => workoutsFromFeed(feed, today)));
}

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = chain.then(task, task);
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function stravaClientConfigured(): boolean {
  const creds = readCreds();
  return creds.clientId !== "" && creds.clientSecret !== "";
}

type StravaFeed =
  | { status: "disconnected"; canConnect: boolean }
  | { status: "error"; code: string; canConnect: boolean }
  | { status: "ready"; stale: boolean; activities: CachedActivity[] }
  | { status: "runs-only"; runs: RawRun[] };

async function loadFeed(today: string): Promise<StravaFeed> {
  const creds = readCreds();
  const canConnect = creds.clientId !== "" && creds.clientSecret !== "";
  if (!canConnect) return { status: "disconnected", canConnect: false };

  const since = shiftIsoDate(mondayOnOrBefore(today), -23);
  try {
    const stored = await readStravaToken();
    if (!stored?.refreshToken && creds.refreshToken === "") {
      return { status: "disconnected", canConnect: true };
    }
    const cached = await readActivityCache();
    if (cached && cacheIsFresh(cached.fetchedAtMs, Date.now()) && cached.sinceDate <= since) {
      return { status: "ready", stale: false, activities: cached.activities };
    }
    if (Date.now() < backoffUntilMs) {
      const paused = await fallbackFeed();
      if (paused.status !== "error") return paused;
      return { status: "error", code: backoffCode, canConnect };
    }

    let accessToken = await accessTokenFor(creds);
    let activities: CachedActivity[];
    try {
      activities = await fetchActivities(accessToken, since);
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "strava_token_401") throw error;
      accessToken = await accessTokenFor(creds, true);
      activities = await fetchActivities(accessToken, since);
    }
    await writeActivityCache(since, activities);
    await writeRunCache(since, activitiesToRuns(activities));
    backoffUntilMs = 0;
    return { status: "ready", stale: false, activities };
  } catch (error) {
    const code = error instanceof Error ? error.message : "strava_unknown";
    if (code === "strava_429" || code.startsWith("strava_activities_") || code.startsWith("strava_token_")) {
      console.error("strava_summary_failed", code);
    } else {
      console.error("strava_summary_failed");
    }
    backoffCode = code;
    backoffUntilMs = Date.now() + (code === "strava_429" ? 15 * 60 * 1000 : 60 * 1000);
    const fallback = await fallbackFeed();
    if (fallback.status !== "error") return fallback;
    return { status: "error", code, canConnect };
  }
}

async function fallbackFeed(): Promise<StravaFeed> {
  const activities = await readActivityCache().catch(() => null);
  if (activities) return { status: "ready", stale: true, activities: activities.activities };
  const runs = await readRunCache().catch(() => null);
  if (runs) return { status: "runs-only", runs: runs.runs };
  return { status: "error", code: "strava_429", canConnect: false };
}

function summaryFromFeed(feed: StravaFeed, today: string): StravaTileModel {
  if (feed.status === "ready") return modelFromRuns(activitiesToRuns(feed.activities), today, feed.stale);
  if (feed.status === "runs-only") return modelFromRuns(feed.runs, today, true);
  if (feed.status === "disconnected") return feed;
  return errorModel(feed.code, feed.canConnect, "Couldn't load runs just now.");
}

function workoutsFromFeed(feed: StravaFeed, today: string): StravaWorkoutsModel {
  if (feed.status === "ready") return modelFromActivities(feed.activities, today, feed.stale);
  if (feed.status === "disconnected") return feed;
  if (feed.status === "runs-only") {
    return { status: "error", message: "Couldn't load workouts just now.", canConnect: false };
  }
  return errorModel(feed.code, feed.canConnect, "Couldn't load workouts just now.");
}

function errorModel(code: string, canConnect: boolean, fallback: string): { status: "error"; message: string; canConnect: boolean } {
  if (code === "strava_token_401" || code === "strava_token_400" || code === "strava_token_invalid") {
    return { status: "error", message: "Strava needs connecting again.", canConnect };
  }
  if (code === "strava_429") {
    return { status: "error", message: "Strava is busy. Try again in a few minutes.", canConnect: false };
  }
  return { status: "error", message: fallback, canConnect: false };
}

function readCreds(): Creds {
  return {
    clientId: process.env.STRAVA_CLIENT_ID?.trim() ?? "",
    clientSecret: process.env.STRAVA_CLIENT_SECRET?.trim() ?? "",
    refreshToken: process.env.STRAVA_REFRESH_TOKEN?.trim() ?? "",
  };
}

async function accessTokenFor(creds: Creds, forceRefresh = false): Promise<string> {
  const stored = await readStravaToken();
  if (
    !forceRefresh &&
    stored?.accessToken &&
    stored.expiresAtMs != null &&
    stored.expiresAtMs > Date.now() + 120_000
  ) {
    return stored.accessToken;
  }

  const candidates = unique([stored?.refreshToken, creds.refreshToken]);
  if (candidates.length === 0) {
    throw new Error("strava_token_401");
  }

  let last = "strava_token_401";
  for (const refreshToken of candidates) {
    try {
      return await refreshAccessToken(creds, refreshToken);
    } catch (error) {
      last = error instanceof Error ? error.message : "strava_token_401";
      if (last === "strava_429") throw error;
    }
  }
  throw new Error(last);
}

async function refreshAccessToken(creds: Creds, refreshToken: string): Promise<string> {
  const body = new URLSearchParams({
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  if (res.status === 429) throw new Error("strava_429");
  const parsed = parseTokenResponse(await readJson(res));
  if (!res.ok || !parsed) throw new Error(`strava_token_${res.ok ? "invalid" : res.status}`);
  await writeStravaToken(parsed);
  return parsed.accessToken;
}

export async function exchangeStravaCode(code: string): Promise<"saved" | "invalid" | "unconfigured" | "busy"> {
  const creds = readCreds();
  if (creds.clientId === "" || creds.clientSecret === "") return "unconfigured";
  const body = new URLSearchParams({
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    code,
    grant_type: "authorization_code",
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  if (res.status === 429) return "busy";
  const parsed = parseTokenResponse(await readJson(res));
  if (!res.ok || !parsed) return "invalid";
  await writeStravaToken(parsed);
  return "saved";
}

/**
 * One list request covers every sport. Stops after three pages, and does not
 * open each activity, so a refresh stays inside Strava's rate limit.
 */
async function fetchActivities(accessToken: string, since: string): Promise<CachedActivity[]> {
  const after = Math.floor(Date.parse(`${shiftIsoDate(since, -1)}T00:00:00Z`) / 1000);
  const activities: CachedActivity[] = [];
  for (let page = 1; page <= 3; page += 1) {
    const url = new URL(ACTIVITIES_URL);
    url.searchParams.set("after", String(after));
    url.searchParams.set("page", String(page));
    url.searchParams.set("per_page", "100");
    const res = await fetch(url, {
      headers: { authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (res.status === 429) throw new Error("strava_429");
    if (res.status === 401) throw new Error("strava_token_401");
    if (!res.ok) throw new Error(`strava_activities_${res.status}`);
    const body = await readJson(res);
    if (!Array.isArray(body)) throw new Error("strava_activities_invalid");
    activities.push(...parseAllActivities(body));
    if (body.length < 100) break;
  }
  return activities;
}

async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function unique(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}
