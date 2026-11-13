import assert from "node:assert/strict";
import test from "node:test";
import { GET as connect } from "../app/api/strava/connect/route";
import { GET as callback } from "../app/api/strava/callback/route";
import {
  readStateCookie,
  statesMatch,
  stravaAuthorizeUrl,
} from "./strava-oauth";
import { readActivityCache, readRunCache, readStravaToken, writeActivityCache, writeRunCache, writeStravaToken } from "./strava-store";
import { getStravaSummary, getStravaWorkouts } from "./strava";
import {
  cacheIsFresh,
  fixtureRuns,
  formatPace,
  isRunActivity,
  mondayOnOrBefore,
  modelFromRuns,
  parseActivities,
  parseTokenResponse,
  summarizeRuns,
} from "./strava-summary";

process.env.FITNESS_PGLITE_MEMORY = "1";

test("week boundaries are Monday to Sunday", () => {
  assert.equal(mondayOnOrBefore("2026-11-12"), "2026-11-09");
  assert.equal(mondayOnOrBefore("2026-11-16"), "2026-11-16");
  assert.equal(mondayOnOrBefore("2026-11-15"), "2026-11-09");
});

test("run totals cover this week and the last four weeks, and ignore rides", () => {
  const today = "2026-11-12";
  const summary = summarizeRuns(fixtureRuns(today), today);
  assert.equal(summary.thisWeek.count, 1);
  assert.equal(summary.thisWeek.distanceM, 5200);
  assert.equal(summary.thisWeek.movingTimeS, 28 * 60 + 40);
  assert.equal(formatPace(summary.thisWeek.paceSecPerKm), "5:31 /km");
  assert.equal(summary.last4Weeks.count, 5);
  assert.equal(summary.last4Weeks.distanceM, 37500);
  assert.equal(summary.recent[0]?.name, "Easy run");
  assert.equal(summary.recent[0]?.date, "2026-11-10");

  const parsed = parseActivities([
    { id: 9, name: "Ride", type: "Ride", sport_type: "Ride", distance: 20000, moving_time: 3600, start_date_local: "2026-11-10T07:00:00Z" },
    { id: 8, name: "Trail", type: "Run", sport_type: "TrailRun", distance: 3000, moving_time: 1200, start_date_local: "2026-11-11T07:00:00" },
    { id: "nope", name: "Bad", type: "Run", start_date_local: "not-a-date" },
  ]);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0]?.name, "Trail");
  assert.equal(isRunActivity({ type: "VirtualRun", sport_type: "VirtualRun" }), true);
  assert.equal(isRunActivity({ type: "WeightTraining" }), false);
});

test("token parsing keeps secrets out of the result shape when the body is incomplete", () => {
  assert.equal(parseTokenResponse({ access_token: "access-test", expires_at: 1_700_000_000 }), null);
  const parsed = parseTokenResponse({
    access_token: "access-test",
    refresh_token: "refresh-test",
    expires_at: 1_700_000_000,
    athlete: { id: 1 },
  });
  assert.deepEqual(parsed, {
    accessToken: "access-test",
    refreshToken: "refresh-test",
    expiresAtMs: 1_700_000_000_000,
  });
  assert.equal(JSON.stringify(parsed).includes("athlete"), false);
});

test("the authorize URL asks for runs and does not carry the client secret", () => {
  const url = new URL(
    stravaAuthorizeUrl({
      clientId: "123",
      redirectUri: "https://training-log.apps.grok.bot/api/strava/callback",
      state: "abc",
    }),
  );
  assert.equal(url.origin + url.pathname, "https://www.strava.com/oauth/authorize");
  assert.equal(url.searchParams.get("client_id"), "123");
  assert.equal(url.searchParams.get("scope"), "activity:read_all");
  assert.equal(url.searchParams.get("state"), "abc");
  assert.equal(url.searchParams.get("redirect_uri"), "https://training-log.apps.grok.bot/api/strava/callback");
  assert.equal(url.search.includes("client_secret"), false);
  assert.equal(statesMatch("abc", "abc"), true);
  assert.equal(statesMatch("abc", "abd"), false);
  assert.equal(statesMatch("abc", "abcd"), false);
  assert.equal(readStateCookie("other=1; strava_oauth_state=abc"), "abc");
  assert.equal(cacheIsFresh(1_000, 1_000 + 14 * 60 * 1000), true);
  assert.equal(cacheIsFresh(1_000, 1_000 + 15 * 60 * 1000), false);
});

test("missing Strava env vars leave the tile disconnected", async () => {
  const previous = {
    id: process.env.STRAVA_CLIENT_ID,
    secret: process.env.STRAVA_CLIENT_SECRET,
    refresh: process.env.STRAVA_REFRESH_TOKEN,
  };
  delete process.env.STRAVA_CLIENT_ID;
  delete process.env.STRAVA_CLIENT_SECRET;
  delete process.env.STRAVA_REFRESH_TOKEN;
  try {
    const summary = await getStravaSummary("2026-11-12");
    assert.deepEqual(summary, { status: "disconnected", canConnect: false });
    const workouts = await getStravaWorkouts("2026-11-12");
    assert.deepEqual(workouts, { status: "disconnected", canConnect: false });
    const response = await connect(new Request("http://localhost/api/strava/connect"));
    assert.equal(response.status, 400);
    const text = await response.text();
    assert.match(text, /not set up yet/);
    assert.equal(text.includes("client_secret"), false);
  } finally {
    restore("STRAVA_CLIENT_ID", previous.id);
    restore("STRAVA_CLIENT_SECRET", previous.secret);
    restore("STRAVA_REFRESH_TOKEN", previous.refresh);
  }
});

test("the callback does not echo the code when the link is stale", async () => {
  const response = await callback(
    new Request("http://localhost/api/strava/callback?code=one-time-code&state=nope"),
  );
  assert.equal(response.status, 400);
  const text = await response.text();
  assert.match(text, /expired/);
  assert.equal(text.includes("one-time-code"), false);
});

test("a rotated refresh token is stored and read back without the activities payload", async () => {
  await writeStravaToken({
    refreshToken: "refresh-test",
    accessToken: "access-test",
    expiresAtMs: Date.parse("2026-11-12T00:00:00Z"),
  });
  const stored = await readStravaToken();
  assert.equal(stored?.refreshToken, "refresh-test");
  assert.equal(stored?.accessToken, "access-test");
  assert.equal(stored?.expiresAtMs, Date.parse("2026-11-12T00:00:00Z"));

  const runs = fixtureRuns("2026-11-12");
  await writeRunCache("2026-10-17", runs);
  const cached = await readRunCache();
  assert.equal(cached?.sinceDate, "2026-10-17");
  assert.equal(cached?.runs.length, runs.length);
  assert.equal(modelFromRuns(cached?.runs ?? [], "2026-11-12").status, "ready");

  await writeActivityCache("2026-11-07", [
    {
      id: 9,
      name: "Park loop",
      type: "Ride",
      sportType: "Ride",
      date: "2026-11-12",
      startLocal: "2026-11-12T07:05:00",
      movingTimeS: 3300,
      distanceM: 22000,
      avgHr: 136,
      calories: null,
      kilojoules: 1799.12,
      sufferScore: 58,
    },
  ]);
  const activities = await readActivityCache();
  assert.equal(activities?.sinceDate, "2026-11-07");
  assert.equal(activities?.activities[0]?.name, "Park loop");
  assert.equal(activities?.activities[0]?.kilojoules, 1799.12);
  assert.equal(activities?.activities[0]?.sufferScore, 58);
  const runsAfter = await readRunCache();
  assert.equal(runsAfter?.runs.length, runs.length);
  assert.equal(runsAfter?.runs.some((run) => run.name === "Park loop"), false);
});

function restore(name: string, value: string | undefined) {
  if (value == null) delete process.env[name];
  else process.env[name] = value;
}
