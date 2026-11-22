import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { GET, POST } from "../app/api/ride-scores/route";
import { parseRideScores, rideRowKey } from "./ride-scores";

process.env.FITNESS_PGLITE_MEMORY = "1";
delete process.env.DATABASE_URL;

const TOKEN = "ride-score-test-token";

test("the ride_scores migration is additive", async () => {
  const sql = await readFile(new URL("../migrations/015_ride_scores.sql", import.meta.url), "utf8");
  assert.match(sql, /create table if not exists ride_scores/i);
  assert.match(sql, /row_key text primary key/i);
  assert.doesNotMatch(sql, /drop table/i);
  assert.doesNotMatch(sql, /alter table run_scores/i);
});

test("parseRideScores validation", () => {
  const bad = parseRideScores({ date: "2026-11-22" });
  assert.ok(bad && "field" in bad);
  assert.equal(bad.field, "start_time");

  const ok = parseRideScores({
    date: "2026-11-22",
    start_time: "2026-11-22T07:00:00+11:00",
    duration_s: 1800,
    drift_bpm: -3.2,
    pct_under_145: 100,
  });
  assert.ok(Array.isArray(ok));
  if (!Array.isArray(ok)) return;
  assert.equal(ok[0]?.row_key, rideRowKey(null, "2026-11-22", "2026-11-22T07:00:00+11:00"));

  const badPct = parseRideScores({
    strava_id: "ride-1",
    date: "2026-11-22",
    pct_under_145: 101,
  });
  assert.ok(badPct && "field" in badPct);
  assert.equal(badPct.field, "pct_under_145");

  const badDrift = parseRideScores({
    strava_id: "ride-1",
    date: "2026-11-22",
    drift_bpm: -200,
  });
  assert.ok(badDrift && "field" in badDrift);
  assert.equal(badDrift.field, "drift_bpm");
});

test("POST /api/ride-scores uses the same bearer as /api/log", async () => {
  const previous = process.env.LOG_API_TOKEN;
  const vercel = process.env.VERCEL;
  process.env.LOG_API_TOKEN = TOKEN;
  process.env.VERCEL = "1";
  delete process.env.CURSOR_APP_ID;
  try {
    const missing = await POST(jsonRequest("{}"));
    assert.equal(missing.status, 401);

    const ok = await POST(jsonRequest("[]", TOKEN));
    assert.equal(ok.status, 200);
    assert.deepEqual(await ok.json(), { upserted: 0, rides: [] });
  } finally {
    restore("LOG_API_TOKEN", previous);
    restore("VERCEL", vercel);
  }
});

test("upsert by strava_id and by date+start_time", async () => {
  const previous = process.env.LOG_API_TOKEN;
  const vercel = process.env.VERCEL;
  process.env.LOG_API_TOKEN = TOKEN;
  process.env.VERCEL = "1";
  delete process.env.CURSOR_APP_ID;
  try {
    const manual = await POST(
      jsonRequest(
        JSON.stringify({
          date: "2026-11-20",
          start_time: "2026-11-20T06:30:00+11:00",
          duration_s: 1200,
          distance_m: 8000,
        }),
        TOKEN,
      ),
    );
    assert.equal(manual.status, 200);
    const strava = await POST(
      jsonRequest(
        JSON.stringify({
          strava_id: "ride-22",
          date: "2026-11-22",
          start_time: "2026-11-22T07:15:00+11:00",
          avg_watts: 140,
          index: 99.96,
        }),
        TOKEN,
      ),
    );
    assert.equal(strava.status, 200);
    const body = (await strava.json()) as { rides: { index: number | null }[] };
    assert.equal(body.rides[0]?.index, 100.0);

    const list = await GET(authed("http://localhost/api/ride-scores?from=2026-11-01"));
    assert.equal(list.status, 200);
    const payload = (await list.json()) as { rides: { row_key: string }[] };
    assert.deepEqual(
      payload.rides.map((r) => r.row_key),
      ["ride-22", "2026-11-20|2026-11-20T06:30:00+11:00"],
    );

    const badFrom = await GET(authed("http://localhost/api/ride-scores?from=2026-11-31"));
    assert.equal(badFrom.status, 400);
  } finally {
    restore("LOG_API_TOKEN", previous);
    restore("VERCEL", vercel);
  }
});

function authed(url: string): Request {
  return new Request(url, { headers: { authorization: `Bearer ${TOKEN}` } });
}

function jsonRequest(body: string, token?: string): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  return new Request("http://localhost/api/ride-scores", { method: "POST", headers, body });
}

function restore(name: string, value: string | undefined) {
  if (value == null) delete process.env[name];
  else process.env[name] = value;
}