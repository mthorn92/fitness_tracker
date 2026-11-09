import assert from "node:assert/strict";
import test from "node:test";
import { buildDeficitSeries, KCAL_PER_KG } from "./deficit";

test("expected kg is cumulative Whoop−food over 7700", () => {
  const summary = buildDeficitSeries("2026-11-06", 104.5, [
    { date: "2026-11-06", whoopKcal: 2453, foodKcal: 0, weightKg: 104.5 },
    { date: "2026-11-07", whoopKcal: 2091, foodKcal: null, weightKg: null },
    { date: "2026-11-09", whoopKcal: 1372, foodKcal: 499, weightKg: 103.5 },
  ]);

  const totalDeficit = 2453 - 0 + 2091 - 0 + 1372 - 499;
  assert.equal(summary.cumulativeDeficitKcal, totalDeficit);
  assert.ok(Math.abs(summary.expectedKgLost - totalDeficit / KCAL_PER_KG) < 1e-9);
  assert.equal(summary.actualKgLost, 1);
  assert.ok(summary.kcalPerKgLost != null);
  assert.ok(Math.abs((summary.kcalPerKgLost ?? 0) - totalDeficit / 1) < 1e-9);
});

test("baseline prefers start weight on start date", () => {
  const summary = buildDeficitSeries("2026-11-01", 110, [
    { date: "2026-11-05", whoopKcal: 2000, foodKcal: 1500, weightKg: 108 },
  ]);
  assert.equal(summary.baselineKg, 110);
  assert.equal(summary.baselineDate, "2026-11-01");
  assert.equal(summary.actualKgLost, 2);
});

test("kcal per kg is null when scale has not moved down", () => {
  const summary = buildDeficitSeries("2026-11-09", 104.5, [
    { date: "2026-11-09", whoopKcal: 1372, foodKcal: 499, weightKg: 104.5 },
  ]);
  assert.equal(summary.actualKgLost, 0);
  assert.equal(summary.kcalPerKgLost, null);
  assert.ok(summary.expectedKgLost > 0);
});
