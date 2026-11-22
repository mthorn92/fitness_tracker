import assert from "node:assert/strict";
import test from "node:test";
import {
  formatDriftBpm,
  formatInclinePair,
  formatResistance,
  formatRideDate,
  formatRideTime,
  formatWPerBpm,
  rideHasScoreColumns,
  ridesForTile,
  type RideScore,
} from "./ride-tile";

test("ride formatters", () => {
  assert.equal(formatRideDate("2026-11-22"), "Sun 22/11");
  assert.equal(formatRideTime(125), "2:05");
  assert.equal(formatRideTime(3661), "1:01:01");
  assert.equal(formatRideTime(null), "—");
  assert.equal(formatWPerBpm(1.108), "1.11");
  assert.equal(formatResistance(14, 16), "14/16");
  assert.equal(formatInclinePair(2.14, 3.01), "2.1/3.0");
  assert.equal(formatDriftBpm(4.84), "+4.8");
  assert.equal(formatDriftBpm(-2.04), "-2.0");
  assert.equal(formatDriftBpm(0), "0.0");
});

test("rideHasScoreColumns and ridesForTile", () => {
  const base: RideScore = {
    row_key: "a",
    strava_id: "a",
    date: "2026-11-20",
    start_time: null,
    name: null,
    duration_s: null,
    distance_m: null,
    avg_watts: null,
    avg_rpm: null,
    resistance_avg: null,
    resistance_max: null,
    incline_avg: null,
    incline_max: null,
    calories: null,
    avg_hr: null,
    max_hr: null,
    p97_hr: null,
    pct_under_145: null,
    drift_bpm: null,
    w_per_bpm: null,
    index: null,
    disc_pts: null,
    eff_pts: null,
    dur_pts: null,
  };
  assert.equal(rideHasScoreColumns([base]), false);
  assert.equal(rideHasScoreColumns([{ ...base, dur_pts: 10 }]), true);
  const filtered = ridesForTile([
    { ...base, date: "2026-10-31", row_key: "old", strava_id: "old" },
    { ...base, date: "2026-11-22", row_key: "new", strava_id: "new", start_time: "2026-11-22T08:00:00+11:00" },
    { ...base, date: "2026-11-21", row_key: "mid", strava_id: "mid" },
  ]);
  assert.deepEqual(filtered.map((r) => r.row_key), ["new", "mid"]);
});