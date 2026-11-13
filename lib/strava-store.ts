import { sql } from "@/lib/db";
import type { CachedActivity } from "@/lib/strava-workouts";
import type { RawRun } from "@/lib/strava-summary";

const TOKEN_ID = "athlete";
const CACHE_ID = "recent";
/** Same table as the run cache. A second row holds every sport. */
const ACTIVITY_CACHE_ID = "activities";

export type StoredToken = {
  refreshToken: string;
  accessToken: string | null;
  expiresAtMs: number | null;
};

export type StoredRunCache = {
  sinceDate: string;
  runs: RawRun[];
  fetchedAtMs: number;
};

export type StoredActivityCache = {
  sinceDate: string;
  activities: CachedActivity[];
  fetchedAtMs: number;
};

export async function readStravaToken(): Promise<StoredToken | null> {
  const rows = await sql<{
    refresh_token: string;
    access_token: string | null;
    expires_at: Date | string | null;
  }>("select refresh_token, access_token, expires_at from strava_token where id = $1", [TOKEN_ID]);
  const row = rows[0];
  if (!row || typeof row.refresh_token !== "string" || row.refresh_token.trim() === "") return null;
  return {
    refreshToken: row.refresh_token,
    accessToken: row.access_token && row.access_token.trim() !== "" ? row.access_token : null,
    expiresAtMs: timeMs(row.expires_at),
  };
}

export async function writeStravaToken(input: {
  refreshToken: string;
  accessToken: string;
  expiresAtMs: number;
}): Promise<void> {
  await sql(
    `insert into strava_token (id, refresh_token, access_token, expires_at, updated_at)
     values ($1, $2, $3, $4, now())
     on conflict (id) do update set
       refresh_token = excluded.refresh_token,
       access_token = excluded.access_token,
       expires_at = excluded.expires_at,
       updated_at = now()`,
    [TOKEN_ID, input.refreshToken, input.accessToken, new Date(input.expiresAtMs).toISOString()],
  );
}

export async function readRunCache(): Promise<StoredRunCache | null> {
  const rows = await sql<{ since_date: string; runs: unknown; fetched_at: Date | string | null }>(
    "select since_date, runs, fetched_at from strava_run_cache where id = $1",
    [CACHE_ID],
  );
  const row = rows[0];
  if (!row || typeof row.since_date !== "string") return null;
  const fetchedAtMs = timeMs(row.fetched_at);
  if (fetchedAtMs == null) return null;
  return { sinceDate: row.since_date, runs: parseCachedRuns(row.runs), fetchedAtMs };
}

export async function writeRunCache(sinceDate: string, runs: RawRun[]): Promise<void> {
  await sql(
    `insert into strava_run_cache (id, since_date, runs, fetched_at)
     values ($1, $2, $3::jsonb, now())
     on conflict (id) do update set
       since_date = excluded.since_date,
       runs = excluded.runs,
       fetched_at = now()`,
    [CACHE_ID, sinceDate, JSON.stringify(runs)],
  );
}

export async function readActivityCache(): Promise<StoredActivityCache | null> {
  const rows = await sql<{ since_date: string; runs: unknown; fetched_at: Date | string | null }>(
    "select since_date, runs, fetched_at from strava_run_cache where id = $1",
    [ACTIVITY_CACHE_ID],
  );
  const row = rows[0];
  if (!row || typeof row.since_date !== "string") return null;
  const fetchedAtMs = timeMs(row.fetched_at);
  if (fetchedAtMs == null) return null;
  return { sinceDate: row.since_date, activities: parseCachedActivities(row.runs), fetchedAtMs };
}

export async function writeActivityCache(sinceDate: string, activities: CachedActivity[]): Promise<void> {
  await sql(
    `insert into strava_run_cache (id, since_date, runs, fetched_at)
     values ($1, $2, $3::jsonb, now())
     on conflict (id) do update set
       since_date = excluded.since_date,
       runs = excluded.runs,
       fetched_at = now()`,
    [ACTIVITY_CACHE_ID, sinceDate, JSON.stringify(activities)],
  );
}

function parseCachedRuns(value: unknown): RawRun[] {
  let parsed: unknown = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  const runs: RawRun[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const id = typeof row.id === "number" ? row.id : Number(row.id);
    const date = typeof row.date === "string" ? row.date : "";
    const name = typeof row.name === "string" ? row.name : "Run";
    const distanceM = typeof row.distanceM === "number" ? row.distanceM : Number(row.distanceM);
    const movingTimeS = typeof row.movingTimeS === "number" ? row.movingTimeS : Number(row.movingTimeS);
    if (!Number.isFinite(id) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    runs.push({
      id,
      name,
      date,
      distanceM: Number.isFinite(distanceM) ? distanceM : 0,
      movingTimeS: Number.isFinite(movingTimeS) ? movingTimeS : 0,
    });
  }
  return runs;
}

function parseCachedActivities(value: unknown): CachedActivity[] {
  const parsed = parseJson(value);
  if (!Array.isArray(parsed)) return [];
  const activities: CachedActivity[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const id = typeof row.id === "number" ? row.id : Number(row.id);
    const date = typeof row.date === "string" ? row.date : "";
    if (!Number.isFinite(id) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const numberOr = (key: string, fallback: number) => {
      const value = row[key];
      return typeof value === "number" && Number.isFinite(value) ? value : fallback;
    };
    const optional = (key: string) => {
      const value = row[key];
      return typeof value === "number" && Number.isFinite(value) ? value : null;
    };
    activities.push({
      id,
      name: typeof row.name === "string" && row.name.trim() !== "" ? row.name : "Activity",
      type: typeof row.type === "string" ? row.type : "",
      sportType: typeof row.sportType === "string" ? row.sportType : "",
      date,
      startLocal: typeof row.startLocal === "string" && row.startLocal !== "" ? row.startLocal : date,
      movingTimeS: Math.max(0, numberOr("movingTimeS", 0)),
      distanceM: Math.max(0, numberOr("distanceM", 0)),
      avgHr: optional("avgHr"),
      calories: optional("calories"),
      kilojoules: optional("kilojoules"),
      sufferScore: optional("sufferScore"),
    });
  }
  return activities;
}

function parseJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function timeMs(value: Date | string | null | undefined): number | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.getTime();
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.getTime();
  }
  return null;
}
