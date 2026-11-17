import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { GET, POST } from "../app/api/run-scores/route";
import { formatRunDate, indexMark, runsForTile, type RunScore } from "./run-tile";

process.env.FITNESS_PGLITE_MEMORY = "1";
delete process.env.DATABASE_URL;

const TOKEN = "run-score-test-token";

test("the run_scores migration is additive", async () => {
  const sql = await readFile(new URL("../migrations/011_run_scores.sql", import.meta.url), "utf8");
  assert.match(sql, /create table if not exists run_scores/i);
  assert.match(sql, /strava_id text primary key/i);
  assert.doesNotMatch(sql, /drop table/i);
  assert.doesNotMatch(sql, /alter table/i);
  assert.doesNotMatch(sql, /strava_token/i);
  assert.doesNotMatch(sql, /workouts/i);
});

test("POST /api/run-scores uses the same bearer as /api/log", async () => {
  const previous = process.env.LOG_API_TOKEN;
  const vercel = process.env.VERCEL;
  process.env.LOG_API_TOKEN = TOKEN;
  process.env.VERCEL = "1";
  delete process.env.CURSOR_APP_ID;
  try {
    const missing = await POST(jsonRequest("{}"));
    assert.equal(missing.status, 401);
    assert.deepEqual(await missing.json(), { error: "unauthorized" });

    const wrong = await POST(jsonRequest("{}", "nope"));
    assert.equal(wrong.status, 401);

    const ok = await POST(jsonRequest("[]", TOKEN));
    assert.equal(ok.status, 200);
    assert.deepEqual(await ok.json(), { upserted: 0, runs: [] });
  } finally {
    restore("LOG_API_TOKEN", previous);
    restore("VERCEL", vercel);
  }
});

test("one row or an array upserts by strava_id and GET is newest first", async () => {
  const previous = process.env.LOG_API_TOKEN;
  const vercel = process.env.VERCEL;
  process.env.LOG_API_TOKEN = TOKEN;
  process.env.VERCEL = "1";
  delete process.env.CURSOR_APP_ID;
  try {
    const one = await POST(
      jsonRequest(
        JSON.stringify(
          score({
            strava_id: "rs-17",
            date: "2026-11-17",
            start_time: "2026-11-17T06:12:00+11:00",
            distance_m: 2950,
            index: 102.16,
          }),
        ),
        TOKEN,
      ),
    );
    assert.equal(one.status, 200);
    const created = await one.json();
    assert.equal(created.upserted, 1);
    assert.equal(created.runs[0].strava_id, "rs-17");
    assert.equal(created.runs[0].date, "2026-11-17");
    assert.equal(created.runs[0].index, 102.2);
    assert.equal(created.runs[0].distance_m, 2950);
    assert.equal(created.runs[0].name, "Morning run");

    const batch = await POST(
      jsonRequest(
        JSON.stringify([
          score({ strava_id: "rs-14", date: "2026-11-14", index: 99.9, distance_m: 3010 }),
          score({ strava_id: "rs-10", date: "2026-11-10", index: 101.1, distance_m: 3010 }),
          score({
            strava_id: "rs-17",
            date: "2026-11-17",
            index: 102.1,
            distance_m: 2950,
            name: "Morning run updated",
          }),
          score({ strava_id: "rs-17", date: "2026-11-17", index: 102.1, distance_m: 2950, name: "Easy run" }),
          score({ strava_id: "rs-old", date: "2026-10-30", index: 110.9, distance_m: 3810 }),
          score({
            strava_id: "rs-13",
            date: "2026-11-13",
            index: null,
            avg_hr: null,
            p97_hr: null,
            pct_under_145: null,
            ef_gap: null,
            distance_m: 3030,
          }),
        ]),
        TOKEN,
      ),
    );
    assert.equal(batch.status, 200);
    const saved = await batch.json();
    assert.equal(saved.upserted, 5);
    assert.equal(saved.runs.find((row: RunScore) => row.strava_id === "rs-17").name, "Easy run");
    assert.equal(saved.runs.find((row: RunScore) => row.strava_id === "rs-13").index, null);

    const all = await GET(authed("http://localhost/api/run-scores"));
    assert.equal(all.status, 200);
    const listed = await all.json();
    assert.equal(listed.from, null);
    assert.deepEqual(
      listed.runs.map((row: RunScore) => row.strava_id),
      ["rs-17", "rs-14", "rs-13", "rs-10", "rs-old"],
    );

    const from = await GET(authed("http://localhost/api/run-scores?from=2026-11-01"));
    const window = await from.json();
    assert.equal(window.from, "2026-11-01");
    assert.deepEqual(
      window.runs.map((row: RunScore) => row.date),
      ["2026-11-17", "2026-11-14", "2026-11-13", "2026-11-10"],
    );

    const badFrom = await GET(authed("http://localhost/api/run-scores?from=2026-11-31"));
    assert.equal(badFrom.status, 400);
    assert.equal((await badFrom.json()).error, "invalid_date");

    const badType = await POST(jsonRequest(JSON.stringify([{ strava_id: 17, date: "2026-11-17" }]), TOKEN));
    assert.equal(badType.status, 400);
    const badBody = await badType.json();
    assert.equal(badBody.error, "invalid_run_scores");
    assert.equal(badBody.field, "strava_id");
    assert.equal(badBody.index, 0);

    const badDate = await POST(
      jsonRequest(JSON.stringify({ strava_id: "rs-x", date: "2026-02-31", index: 102.1 }), TOKEN),
    );
    assert.equal(badDate.status, 400);
    assert.equal((await badDate.json()).field, "date");

    const badIndex = await POST(
      jsonRequest(JSON.stringify({ strava_id: "rs-x", date: "2026-11-17", index: "102.1" }), TOKEN),
    );
    assert.equal(badIndex.status, 400);
    assert.equal((await badIndex.json()).field, "index");

    const notJson = await POST(
      new Request("http://localhost/api/run-scores", {
        method: "POST",
        headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
        body: "{",
      }),
    );
    assert.equal(notJson.status, 400);
    assert.equal((await notJson.json()).error, "invalid_json");
  } finally {
    restore("LOG_API_TOKEN", previous);
    restore("VERCEL", vercel);
  }
});

test("tile marks follow the mockup: colour vs 100, arrow vs the older run", () => {
  const rows = runsForTile([
    score({ strava_id: "old", date: "2026-10-30", index: 110.9 }),
    score({ strava_id: "10", date: "2026-11-10", index: 101.1 }),
    score({ strava_id: "13", date: "2026-11-13", index: 98.9 }),
    score({ strava_id: "14", date: "2026-11-14", index: 99.9 }),
    score({ strava_id: "17", date: "2026-11-17", index: 102.1 }),
    score({ strava_id: "08", date: "2026-11-08", index: 110.9 }),
  ]);
  assert.deepEqual(
    rows.map((row) => row.date),
    ["2026-11-17", "2026-11-14", "2026-11-13", "2026-11-10", "2026-11-08"],
  );
  assert.equal(formatRunDate("2026-11-17"), "Tue 17/11");
  assert.equal(formatRunDate("2026-11-14"), "Sat 14/11");
  assert.equal(formatRunDate("2026-11-13"), "Fri 13/11");
  assert.equal(formatRunDate("2026-11-10"), "Tue 10/11");

  const marks = rows.map((row, i) => indexMark(row.index, i + 1 < rows.length ? rows[i + 1]?.index : undefined));
  assert.deepEqual(marks, [
    { text: "102.1", tone: "above", arrow: "up" },
    { text: "99.9", tone: "below", arrow: "up" },
    { text: "98.9", tone: "below", arrow: "down" },
    { text: "101.1", tone: "above", arrow: "down" },
    { text: "110.9", tone: "above", arrow: null },
  ]);
  assert.deepEqual(indexMark(100, 99), { text: "100.0", tone: "even", arrow: "up" });
  assert.deepEqual(indexMark(null, 100), { text: "—", tone: "none", arrow: null });
});

function score(partial: Partial<RunScore> & Pick<RunScore, "strava_id" | "date">): RunScore {
  return {
    strava_id: partial.strava_id,
    date: partial.date,
    start_time: partial.start_time ?? null,
    name: "name" in partial ? (partial.name ?? null) : "Morning run",
    distance_m: partial.distance_m ?? 2950,
    elev_gain_m: partial.elev_gain_m ?? 4,
    elev_loss_m: partial.elev_loss_m ?? 45,
    avg_hr: "avg_hr" in partial ? (partial.avg_hr ?? null) : 126,
    p97_hr: "p97_hr" in partial ? (partial.p97_hr ?? null) : 142,
    pct_under_145: "pct_under_145" in partial ? (partial.pct_under_145 ?? null) : 100,
    ef_gap: "ef_gap" in partial ? (partial.ef_gap ?? null) : 0.97,
    disc: partial.disc ?? 100,
    eff: partial.eff ?? 100,
    dist: partial.dist ?? 100,
    elev: partial.elev ?? 121,
    index: "index" in partial ? (partial.index ?? null) : 102.1,
  };
}

function authed(url: string): Request {
  return new Request(url, { headers: { authorization: `Bearer ${TOKEN}` } });
}

function jsonRequest(body: string, token?: string): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  return new Request("http://localhost/api/run-scores", { method: "POST", headers, body });
}

function restore(name: string, value: string | undefined) {
  if (value == null) delete process.env[name];
  else process.env[name] = value;
}
