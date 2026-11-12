import assert from "node:assert/strict";
import test from "node:test";
import {
  ASSUMED_TDEE_KCAL,
  buildDeficitSeries,
  buildFixedTdeeDeficitSeries,
  dailyDeficitKcal,
  deficitInProgressLabel,
  fixedTdeeCumulativeForChartDays,
  fixedTdeeDailyDeficitKcal,
  fixedTdeeSeriesLabel,
  hasDeficitAnchor,
  isChartDayIncluded,
  isDeficitDayReady,
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

test("fixed TDEE deficit is 2700 minus food and ignores WHOOP burn", () => {
  assert.equal(ASSUMED_TDEE_KCAL, 2700);
  assert.equal(fixedTdeeSeriesLabel(), "Fixed TDEE 2,700");
  assert.equal(fixedTdeeDailyDeficitKcal(2000), 700);
  assert.equal(fixedTdeeDailyDeficitKcal(2700), 0);
  assert.equal(fixedTdeeDailyDeficitKcal(3000), -300);

  const lowBurn = buildFixedTdeeDeficitSeries([
    { date: "2026-11-08", whoopKcal: 2000, foodKcal: 1800, weightKg: 100 },
  ]);
  const highBurn = buildFixedTdeeDeficitSeries([
    { date: "2026-11-08", whoopKcal: 4000, foodKcal: 1800, weightKg: 100 },
  ]);
  assert.equal(lowBurn.cumulativeDeficitKcal, 900);
  assert.equal(highBurn.cumulativeDeficitKcal, 900);
  assert.equal(lowBurn.points[0].dailyDeficitKcal, 900);
  assert.ok(Math.abs(lowBurn.expectedKgLost - 900 / KCAL_PER_KG) < 1e-9);
});

test("fixed TDEE series uses the same days as the WHOOP deficit series", () => {
  const days = [
    { date: "2026-11-06", whoopKcal: 2453, foodKcal: null, weightKg: null },
    { date: "2026-11-07", whoopKcal: 2091, foodKcal: null, weightKg: 104 },
    { date: "2026-11-08", whoopKcal: 2000, foodKcal: 1800, weightKg: 103.8 },
    { date: "2026-11-09", whoopKcal: 1372, foodKcal: 499, weightKg: 103.5 },
    { date: "2026-11-10", whoopKcal: 2200, foodKcal: null, weightKg: 103.2 },
    {
      date: "2026-11-11",
      whoopKcal: 2100,
      foodKcal: 2500,
      weightKg: null,
      cycleClosed: false,
    },
  ];
  const whoop = buildDeficitSeries(days, { today: "2026-11-12" });
  const fixed = buildFixedTdeeDeficitSeries(days, { today: "2026-11-12" });

  assert.deepEqual(
    fixed.points.map((point) => point.date),
    whoop.points.map((point) => point.date),
  );
  // Nov 8: 2700−1800, Nov 9: +2700−499, Nov 10 has no food so it stays flat,
  // Nov 11 is a past open cycle and still counts: +2700−2500.
  assert.deepEqual(
    fixed.points.map((point) => point.cumulativeDeficitKcal),
    [900, 3101, 3101, 3301],
  );
  assert.equal(fixed.points[2].dailyDeficitKcal, null);
  assert.equal(fixed.points[2].foodKcal, null);
  assert.ok(Math.abs(fixed.expectedKgLost - 3301 / KCAL_PER_KG) < 1e-9);
  assert.equal(whoop.cumulativeDeficitKcal, 2000 - 1800 + (1372 - 499) + (2100 - 2500));
});

test("fixed TDEE series excludes incomplete today", () => {
  const days = [
    { date: "2026-11-08", whoopKcal: 2000, foodKcal: 1500, weightKg: 104.5, complete: true },
    { date: "2026-11-09", whoopKcal: 1372, foodKcal: 499, weightKg: 104, complete: false },
  ];
  const whoop = buildDeficitSeries(days, { today: "2026-11-09" });
  const fixed = buildFixedTdeeDeficitSeries(days, { today: "2026-11-09" });

  assert.deepEqual(
    fixed.points.map((point) => point.date),
    whoop.points.map((point) => point.date),
  );
  assert.deepEqual(
    fixed.points.map((point) => point.date),
    ["2026-11-08"],
  );
  assert.equal(fixed.cumulativeDeficitKcal, 2700 - 1500);
  assert.equal(whoop.cumulativeDeficitKcal, 500);
});

test("chart fixed-TDEE line follows plotted days and skips food with no burn", () => {
  const series = fixedTdeeCumulativeForChartDays([
    { plotted: false, foodKcal: 1800, whoopKcal: 2000 },
    { plotted: true, foodKcal: 1800, whoopKcal: 2000 },
    { plotted: true, foodKcal: null, whoopKcal: 2200 },
    { plotted: true, foodKcal: 1600, whoopKcal: null },
    { plotted: false, foodKcal: 1000, whoopKcal: 2100 },
    { plotted: true, foodKcal: 2500, whoopKcal: 2100 },
  ]);

  assert.deepEqual(series.values, [null, 900, 900, 900, null, 1100]);
  assert.equal(series.cumulativeDeficitKcal, 1100);
  assert.ok(Math.abs(series.expectedKgLost - 1100 / KCAL_PER_KG) < 1e-9);
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
  assert.equal(isDeficitDayReady({ date: "2026-11-09", cycleClosed: false }, "2026-11-10"), true);
  assert.equal(isDeficitDayReady({ date: "2026-11-09", cycleClosed: false }, "2026-11-09"), false);
  assert.equal(isDeficitDayReady({ date: "2026-11-10", cycleClosed: false, complete: true }, "2026-11-10"), true);
});

test("counts past day even when WHOOP cycle still open", () => {
  const summary = buildDeficitSeries(
    [
      {
        date: "2026-11-09",
        whoopKcal: 2200,
        foodKcal: 1800,
        weightKg: 104.5,
        cycleClosed: false,
      },
    ],
    { today: "2026-11-10" },
  );
  assert.equal(summary.points.length, 1);
  assert.equal(summary.cumulativeDeficitKcal, 400);
});

test("excludes open cycle on calendar today", () => {
  const summary = buildDeficitSeries(
    [
      {
        date: "2026-11-09",
        whoopKcal: 2200,
        foodKcal: 1800,
        weightKg: 104.5,
        cycleClosed: false,
      },
    ],
    { today: "2026-11-09" },
  );
  assert.equal(summary.points.length, 0);
  assert.equal(summary.cumulativeDeficitKcal, 0);
});

test("in-progress label is calendar today, never the previous open day", () => {
  const yesterday = {
    date: "2026-11-10",
    label: "Tue, 10 Nov",
    cycleClosed: false as boolean | null,
    complete: false,
  };
  assert.equal(deficitInProgressLabel([yesterday], "2026-11-11"), null);

  assert.equal(
    deficitInProgressLabel(
      [yesterday, { date: "2026-11-11", label: "Wed, 11 Nov", cycleClosed: false, complete: false }],
      "2026-11-11",
    ),
    "Wed, 11 Nov",
  );

  assert.equal(
    deficitInProgressLabel(
      [{ date: "2026-11-11", label: "Wed, 11 Nov", cycleClosed: true, complete: false }],
      "2026-11-11",
    ),
    null,
  );
  assert.equal(
    deficitInProgressLabel(
      [{ date: "2026-11-11", label: "Wed, 11 Nov", cycleClosed: false, complete: true }],
      "2026-11-11",
    ),
    null,
  );
});
