import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDeficitSeries,
  dailyDeficitKcal,
  hasDeficitAnchor,
  isChartDayIncluded,
  KCAL_PER_KG,
} from "./deficit";

test("series starts at first day with Whoop + food + weight", () => {
  const summary = buildDeficitSeries([
    { date: "2026-11-06", whoopKcal: 2453, foodKcal: null, weightKg: null },
    { date: "2026-11-07", whoopKcal: 2091, foodKcal: null, weightKg: 104.0 },
    { date: "2026-11-08", whoopKcal: 2000, foodKcal: 1800, weightKg: 103.8 },
    { date: "2026-11-09", whoopKcal: 1372, foodKcal: 499, weightKg: 103.5 },
  ]);

  assert.equal(summary.baselineDate, "2026-11-08");
  assert.equal(summary.baselineKg, 103.8);
  assert.equal(summary.points[0].date, "2026-11-08");
  assert.ok(!summary.points.some((point) => point.date < "2026-11-08"));

  const totalDeficit = 2000 - 1800 + 1372 - 499;
  assert.equal(summary.cumulativeDeficitKcal, totalDeficit);
  assert.ok(Math.abs(summary.expectedKgLost - totalDeficit / KCAL_PER_KG) < 1e-9);
  assert.ok(Math.abs((summary.actualKgLost ?? 0) - 0.3) < 1e-9);
});

test("does not invent food=0 before both deficit inputs exist", () => {
  const summary = buildDeficitSeries([
    { date: "2026-11-06", whoopKcal: 2453, foodKcal: null, weightKg: 104.5 },
    { date: "2026-11-09", whoopKcal: 1372, foodKcal: 499, weightKg: 104.5 },
  ]);

  assert.equal(summary.baselineDate, "2026-11-09");
  assert.equal(summary.points.length, 1);
  assert.equal(summary.cumulativeDeficitKcal, 1372 - 499);
});

test("excludes incomplete today from the series", () => {
  const summary = buildDeficitSeries(
    [
      { date: "2026-11-08", whoopKcal: 2000, foodKcal: 1500, weightKg: 104.5, complete: true },
      { date: "2026-11-09", whoopKcal: 1372, foodKcal: 499, weightKg: 104.0, complete: false },
    ],
    { today: "2026-11-09" },
  );

  assert.equal(summary.points.length, 1);
  assert.equal(summary.points[0].date, "2026-11-08");
  assert.equal(summary.cumulativeDeficitKcal, 500);
  assert.equal(summary.actualKgLost, 0);
});

test("includes today when marked complete", () => {
  const summary = buildDeficitSeries(
    [{ date: "2026-11-09", whoopKcal: 1372, foodKcal: 499, weightKg: 104.5, complete: true }],
    { today: "2026-11-09" },
  );

  assert.equal(summary.points.length, 1);
  assert.equal(summary.cumulativeDeficitKcal, 873);
});

test("kcal per kg is null when scale has not moved down", () => {
  const summary = buildDeficitSeries([
    { date: "2026-11-09", whoopKcal: 1372, foodKcal: 499, weightKg: 104.5 },
  ]);
  assert.equal(summary.actualKgLost, 0);
  assert.equal(summary.kcalPerKgLost, null);
  assert.ok(summary.expectedKgLost > 0);
});

test("daily deficit is burn minus food", () => {
  assert.equal(dailyDeficitKcal(2200, 2000), 200);
  assert.equal(dailyDeficitKcal(1800, 2500), -700);
  assert.equal(dailyDeficitKcal(2000, 2000), 0);
});

test("anchor and today helpers", () => {
  assert.equal(
    hasDeficitAnchor({ date: "2026-11-09", whoopKcal: 1, foodKcal: 0, weightKg: 100 }),
    true,
  );
  assert.equal(
    hasDeficitAnchor({ date: "2026-11-09", whoopKcal: 1, foodKcal: null, weightKg: 100 }),
    false,
  );
  assert.equal(isChartDayIncluded({ date: "2026-11-09", complete: false }, "2026-11-09"), false);
  assert.equal(isChartDayIncluded({ date: "2026-11-09", complete: true }, "2026-11-09"), true);
  assert.equal(isChartDayIncluded({ date: "2026-11-08", complete: false }, "2026-11-09"), true);
});
