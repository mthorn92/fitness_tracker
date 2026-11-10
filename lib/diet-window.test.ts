import assert from "node:assert/strict";
import test from "node:test";
import { dietChartStartDate, enumerateIsoDates } from "./diet-window";

test("chart starts at first food+WHOOP day, skipping WHOOP-only prelude", () => {
  const start = dietChartStartDate(
    [
      { date: "2026-11-06", foodKcal: null, whoopKcal: 2453 },
      { date: "2026-11-07", foodKcal: null, whoopKcal: 2091 },
      { date: "2026-11-08", foodKcal: null, whoopKcal: 2738 },
      { date: "2026-11-09", foodKcal: 1990, whoopKcal: 1372 },
    ],
    "2026-11-10",
  );
  assert.equal(start, "2026-11-09");
});

test("falls back to yesterday when nothing logged yet", () => {
  assert.equal(dietChartStartDate([], "2026-11-10"), "2026-11-09");
});

test("enumerateIsoDates is inclusive", () => {
  assert.deepEqual(enumerateIsoDates("2026-11-09", "2026-11-10"), ["2026-11-09", "2026-11-10"]);
  assert.deepEqual(enumerateIsoDates("2026-11-09", "2026-11-09"), ["2026-11-09"]);
});
