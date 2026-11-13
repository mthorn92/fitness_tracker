import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { GET, POST } from "../app/api/workouts/route";
import { loadExerciseActivities } from "./workouts";

process.env.FITNESS_PGLITE_MEMORY = "1";
delete process.env.DATABASE_URL;

const TOKEN = "workout-test-token";

test("the workouts migration is additive and leaves the Strava token table", async () => {
  const sql = await readFile(new URL("../migrations/008_workouts.sql", import.meta.url), "utf8");
  assert.match(sql, /create table if not exists workouts/i);
  assert.match(sql, /strava_id bigint primary key/i);
  assert.doesNotMatch(sql, /drop table/i);
  assert.doesNotMatch(sql, /strava_token/i);
  assert.doesNotMatch(sql, /alter table foods/i);
});

test("POST /api/workouts requires the same bearer as /api/log", async () => {
  const previous = process.env.LOG_API_TOKEN;
  const vercel = process.env.VERCEL;
  process.env.LOG_API_TOKEN = TOKEN;
  process.env.VERCEL = "1";
  delete process.env.CURSOR_APP_ID;
  try {
    const missing = await POST(jsonRequest("[]"));
    assert.equal(missing.status, 401);
    assert.deepEqual(await missing.json(), { error: "unauthorized" });

    const wrong = await POST(jsonRequest("[]", "nope"));
    assert.equal(wrong.status, 401);

    const ok = await POST(jsonRequest("[]", TOKEN));
    assert.equal(ok.status, 200);
    const body = await ok.json();
    assert.equal(body.upserted, 0);
    assert.deepEqual(body.activities, []);
  } finally {
    restore("LOG_API_TOKEN", previous);
    restore("VERCEL", vercel);
  }
});

test("upserts are idempotent by strava_id and GET filters the local-date range", async () => {
  const previous = process.env.LOG_API_TOKEN;
  const vercel = process.env.VERCEL;
  process.env.LOG_API_TOKEN = TOKEN;
  process.env.VERCEL = "1";
  delete process.env.CURSOR_APP_ID;
  try {
    const first = await POST(
      jsonRequest(
        JSON.stringify([
          activity({ strava_id: 880000001, start_time: "2026-11-10T06:30:00+11:00", name: "Easy run", type: "Run" }),
          activity({
            strava_id: 880000002,
            start_time: "2026-11-12T07:05:00+11:00",
            name: "Park loop",
            type: "Ride",
            sport_type: "Ride",
            distance_m: 22000,
          }),
          activity({
            strava_id: 880000003,
            start_time: "2026-11-01T18:00:00+11:00",
            name: "Old swim",
            type: "Swim",
            sport_type: "Swim",
          }),
        ]),
        TOKEN,
      ),
    );
    assert.equal(first.status, 200);
    const created = await first.json();
    assert.equal(created.upserted, 3);
    assert.equal(created.activities.length, 3);
    assert.equal(typeof created.last_synced_at, "string");
    const run = created.activities.find((row: { strava_id: number }) => row.strava_id === 880000001);
    assert.equal(run.start_time, "2026-11-10T06:30:00+11:00");
    assert.equal(run.avg_hr, 151);
    assert.equal(run.max_hr, null);

    const again = await POST(
      jsonRequest(
        JSON.stringify([
          activity({
            strava_id: 880000001,
            start_time: "2026-11-10T06:40:00+11:00",
            name: "Easy run updated",
            type: "Run",
            distance_m: 6400,
          }),
          activity({
            strava_id: 880000001,
            start_time: "2026-11-10T06:45:00+11:00",
            name: "Easy run final",
            type: "Run",
            distance_m: 6500,
          }),
        ]),
        TOKEN,
      ),
    );
    assert.equal(again.status, 200);
    const updated = await again.json();
    assert.equal(updated.upserted, 1);
    assert.equal(updated.activities[0].name, "Easy run final");
    assert.equal(updated.activities[0].distance_m, 6500);
    assert.equal(updated.activities[0].start_time, "2026-11-10T06:45:00+11:00");

    const ranged = await GET(
      new Request("http://localhost/api/workouts?from=2026-11-07&to=2026-11-12", {
        headers: { authorization: `Bearer ${TOKEN}` },
      }),
    );
    assert.equal(ranged.status, 200);
    const window = await ranged.json();
    assert.equal(window.from, "2026-11-07");
    assert.equal(window.to, "2026-11-12");
    assert.deepEqual(
      window.activities.map((row: { strava_id: number }) => row.strava_id),
      [880000002, 880000001],
    );
    assert.equal(window.activities.some((row: { name: string }) => row.name === "Old swim"), false);

    const bad = await GET(
      new Request("http://localhost/api/workouts?from=2026-11-12&to=2026-11-07", {
        headers: { authorization: `Bearer ${TOKEN}` },
      }),
    );
    assert.equal(bad.status, 400);
    assert.equal((await bad.json()).error, "invalid_range");

    const half = await GET(
      new Request("http://localhost/api/workouts?from=2026-11-07", {
        headers: { authorization: `Bearer ${TOKEN}` },
      }),
    );
    assert.equal(half.status, 400);

    const invalid = await POST(jsonRequest(JSON.stringify([{ strava_id: 1 }]), TOKEN));
    assert.equal(invalid.status, 400);
    const invalidBody = await invalid.json();
    assert.equal(invalidBody.error, "invalid_activities");
    assert.equal(invalidBody.index, 0);

    const tiles = await loadExerciseActivities("2026-11-13");
    assert.equal(tiles.workouts.status, "ready");
    assert.equal(tiles.runs.status, "ready");
    if (tiles.workouts.status !== "ready" || tiles.runs.status !== "ready") return;
    assert.equal(typeof tiles.workouts.syncedAt, "string");
    assert.equal(tiles.runs.syncedAt, tiles.workouts.syncedAt);
    assert.equal(tiles.workouts.rows.some((row) => row.name === "Easy run final"), true);
    assert.equal(tiles.workouts.rows.some((row) => row.name === "Old swim"), false);
    assert.equal(tiles.runs.recent.some((run) => run.name === "Easy run final"), true);
    assert.equal(tiles.runs.recent.some((run) => run.name === "Park loop"), false);
  } finally {
    restore("LOG_API_TOKEN", previous);
    restore("VERCEL", vercel);
  }
});

function activity(partial: {
  strava_id: number;
  start_time: string;
  name: string;
  type: string;
  sport_type?: string;
  distance_m?: number;
}): Record<string, unknown> {
  return {
    strava_id: partial.strava_id,
    start_time: partial.start_time,
    type: partial.type,
    sport_type: partial.sport_type ?? partial.type,
    name: partial.name,
    distance_m: partial.distance_m ?? 6100,
    moving_time_s: 1920,
    elapsed_time_s: 2000,
    avg_hr: 151,
    kcal: 310,
  };
}

function jsonRequest(body: string, token?: string): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  return new Request("http://localhost/api/workouts", { method: "POST", headers, body });
}

function restore(name: string, value: string | undefined) {
  if (value == null) delete process.env[name];
  else process.env[name] = value;
}
