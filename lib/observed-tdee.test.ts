import assert from "node:assert/strict";
import test from "node:test";
import { PERSONAL_KCAL_REFERENCE } from "./personal-kcal";
import {
  buildObservedTdeeModel,
  formatTdeeCaption,
  formatWhoopComparison,
  isCompletedPastDay,
  OBSERVED_TDEE_FOOTNOTE,
} from "./observed-tdee";

const TODAY = "2026-11-16";

function day(
  date: string,
  kcal: number,
  weight: number,
  whoop: number,
  cycleClosed = true,
) {
  return {
    date,
    kcal,
    weight_kg: weight,
    whoop_burn_kcal: whoop,
    cycle_closed: cycleClosed,
    complete: false,
  };
}

test("completed past days exclude the future and an open today", () => {
  assert.equal(isCompletedPastDay("2026-11-15", TODAY), true);
  assert.equal(isCompletedPastDay("2026-11-17", TODAY), false);
  assert.equal(isCompletedPastDay(TODAY, TODAY, { cycle_closed: false, complete: false }), false);
  assert.equal(isCompletedPastDay(TODAY, TODAY, { cycle_closed: true }), true);
  assert.equal(isCompletedPastDay(TODAY, TODAY, { complete: true }), true);
});

test("observed TDEE is 7-day eaten plus the smoothed weight drop", () => {
  const days = [
    day("2026-11-02", 1800, 80, 2500),
    day("2026-11-03", 1800, 80, 2500),
    day("2026-11-04", 1800, 80, 2500),
    day("2026-11-05", 1800, 80, 2500),
    day("2026-11-06", 1800, 80, 2500),
    day("2026-11-07", 1800, 80, 2500),
    day("2026-11-08", 1800, 80, 2500),
    day("2026-11-09", 2000, 79.3, 3000),
    day("2026-11-10", 2000, 79.3, 3000),
    day("2026-11-11", 2000, 79.3, 3000),
    day("2026-11-12", 2000, 79.3, 9000, false),
    day("2026-11-13", 2000, 79.3, 3000),
    day("2026-11-14", 2000, 79.3, 3000),
    day("2026-11-15", 2500, 79.3, 3000),
    day(TODAY, 5000, 70, 9000, false),
    day("2026-11-17", 8000, 60, 9000, true),
  ];

  const model = buildObservedTdeeModel({
    days,
    today: TODAY,
    budgetKcal: 2000,
    weights: [{ date: TODAY, kg: 70 }, { date: "2026-11-17", kg: 60 }],
  });

  assert.equal(model.budgetKcal, 2000);
  assert.equal(model.latest?.date, "2026-11-15");
  const eatenAvg = (2000 * 6 + 2500) / 7;
  const kgLost = 80 - 79.3;
  const expected = eatenAvg + (kgLost * PERSONAL_KCAL_REFERENCE) / 7;
  assert.ok(model.latest);
  assert.ok(Math.abs(model.latest.tdee - expected) < 1e-6);
  assert.ok(Math.abs((model.latest.eatenAvg ?? 0) - eatenAvg) < 1e-6);
  assert.ok(Math.abs(model.latest.kgLost - kgLost) < 1e-6);
  assert.equal(model.latest.whoopAvg, 3000);

  const nov15 = model.points.find((point) => point.date === "2026-11-15");
  assert.ok(nov15);
  const weightPrevious = (80 + 79.3 * 6) / 7;
  const daily = 2500 + (weightPrevious - 79.3) * PERSONAL_KCAL_REFERENCE;
  assert.ok(Math.abs((nov15.daily ?? 0) - daily) < 1e-6);
  assert.equal(nov15.whoopDaily, 3000);
  assert.notEqual(nov15.daily, nov15.rolling);

  const openCycle = model.points.find((point) => point.date === "2026-11-12");
  assert.equal(openCycle?.whoopDaily, null);
  assert.equal(model.points.some((point) => point.date === TODAY), false);
  assert.equal(model.points.some((point) => point.date === "2026-11-17"), false);
});

test("a closed today is included and WHOOP burn does not move the food budget", () => {
  const days = [];
  for (let index = 0; index < 14; index += 1) {
    const date = `2026-11-${String(index + 1).padStart(2, "0")}`;
    days.push(day(date, 1960, 80 - index * 0.05, 4000, true));
  }
  const model = buildObservedTdeeModel({ days, today: "2026-11-14", budgetKcal: 2000 });
  assert.equal(model.latest?.date, "2026-11-14");
  assert.equal(model.budgetKcal, 2000);
  assert.ok((model.latest?.tdee ?? 0) < 4000);
});

test("WHOOP comparison and the formula caption use the displayed rounding", () => {
  assert.equal(formatWhoopComparison(2910, 2640), "WHOOP avg 2,910 · reads +270 high");
  assert.equal(formatWhoopComparison(2400, 2640), "WHOOP avg 2,400 · reads -240 low");
  assert.equal(formatWhoopComparison(2640.4, 2639.6), "WHOOP avg 2,640 · reads +0");
  assert.equal(formatWhoopComparison(2910.4, 2640.6), "WHOOP avg 2,910 · reads +269 high");
  assert.equal(
    formatTdeeCaption(1960, 0.62),
    "7-day avg eaten 1,960 + 0.62 kg lost × 7,700 ÷ 7",
  );
  assert.match(OBSERVED_TDEE_FOOTNOTE, /Early weeks read high from water weight/);
});
