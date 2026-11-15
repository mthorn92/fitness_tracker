import assert from "node:assert/strict";
import test from "node:test";
import {
  addCalendarMonths,
  averageLineValue,
  buildDietChartModel,
  isOpenToday,
  chartRangeStart,
  formatKcalPerDay,
  formatProteinPerDay,
  formatWaterPerDay,
  formatWeekStartLabel,
  isWeeklyChartRange,
  meanOfLogged,
  parseChartRange,
  sumOfLogged,
  weekStartMonday,
  type RangeDay,
} from "./chart-range";

const targets = { calories_kcal: 2000, protein_g: 170, water_l: 3 };

function day(partial: Partial<RangeDay> & { date: string }): RangeDay {
  return {
    label: partial.date,
    weight_kg: null,
    kcal: null,
    protein_g: 0,
    water_l: 0,
    whoop_burn_kcal: null,
    deficit_kcal: null,
    cumulative_deficit_kcal: null,
    ...partial,
  };
}

test("an unknown range falls back to 14 days", () => {
  assert.equal(parseChartRange(undefined), "14d");
  assert.equal(parseChartRange(""), "14d");
  assert.equal(parseChartRange("nope"), "14d");
  assert.equal(parseChartRange(["all", "14d"]), "all");
  assert.equal(parseChartRange("6m"), "6m");
  assert.equal(isWeeklyChartRange("14d"), false);
  assert.equal(isWeeklyChartRange("1m"), false);
  assert.equal(isWeeklyChartRange("6m"), true);
  assert.equal(isWeeklyChartRange("all"), true);
});

test("range starts are inclusive calendar windows", () => {
  assert.equal(chartRangeStart("14d", "2026-11-13"), "2026-10-31");
  assert.equal(chartRangeStart("1m", "2026-11-13"), "2026-10-13");
  assert.equal(chartRangeStart("1m", "2026-03-31"), "2026-02-28");
  assert.equal(addCalendarMonths("2026-01-31", -1), "2025-12-31");
  assert.equal(chartRangeStart("6m", "2026-11-13"), "2026-05-13");
  assert.equal(chartRangeStart("all", "2026-11-13"), null);
});

test("14 days keeps daily bars and drops days outside the window", () => {
  const model = buildDietChartModel({
    days: [
      day({ date: "2026-10-30", kcal: 9000, protein_g: 10, water_l: 9 }),
      day({ date: "2026-10-31", kcal: 1000, protein_g: 100, water_l: 2 }),
      day({ date: "2026-11-13", kcal: 2000, protein_g: 150, water_l: 3 }),
    ],
    weightRolling7: [1, 2, 3],
    range: "14d",
    targets,
    goalWeightKg: 95,
  });

  assert.equal(model.weekly, false);
  assert.deepEqual(model.labels, ["2026-10-31", "2026-11-13"]);
  assert.deepEqual(model.kcal, [1000, 2000]);
  assert.equal(model.targets.calories_kcal, 2000);
  assert.equal(model.targets.protein_g, 170);
  assert.equal(model.targets.water_l, 3);
  assert.equal(model.goalWeightKg, 95);
  assert.equal(model.averages.kcalPerDay, 1500);
  assert.equal(model.averages.kcalLine, 1500);
  assert.deepEqual(model.weightAvg7, [2, 3]);
});

test("weekly buckets sum intake, average weight, and keep the 7-day line", () => {
  const model = buildDietChartModel({
    days: [
      day({
        date: "2026-11-08",
        weight_kg: 70,
        kcal: 500,
        protein_g: 40,
        water_l: 1,
        whoop_burn_kcal: 1800,
      }),
      day({
        date: "2026-11-09",
        weight_kg: 80,
        kcal: 1000,
        protein_g: 100,
        water_l: 2,
        whoop_burn_kcal: 2000,
      }),
      day({
        date: "2026-11-10",
        weight_kg: null,
        kcal: null,
        protein_g: 999,
        water_l: 0,
        whoop_burn_kcal: null,
      }),
      day({
        date: "2026-11-11",
        weight_kg: 100,
        kcal: 2000,
        protein_g: 0,
        water_l: 3,
        whoop_burn_kcal: 1000,
      }),
    ],
    weightRolling7: [90, 90, 91, 92],
    range: "all",
    targets,
    goalWeightKg: 95,
  });

  assert.equal(weekStartMonday("2026-11-08"), "2026-11-02");
  assert.equal(weekStartMonday("2026-11-09"), "2026-11-09");
  assert.equal(formatWeekStartLabel("2026-11-09"), "9 Nov");
  assert.equal(model.weekly, true);
  assert.deepEqual(model.labels, ["2 Nov", "9 Nov"]);
  assert.deepEqual(model.kcal, [500, 3000]);
  assert.deepEqual(model.proteinG, [40, 100]);
  assert.deepEqual(model.waterL, [1, 5]);
  assert.deepEqual(model.whoopKcal, [1800, 3000]);
  assert.deepEqual(model.weightKg, [70, 90]);
  assert.notEqual(model.weightKg[1], 180);
  assert.deepEqual(model.weightAvg7, [90, 92]);
  assert.equal(model.goalWeightKg, 95);
  assert.equal(model.targets.calories_kcal, 14000);
  assert.equal(model.targets.protein_g, 1190);
  assert.equal(model.targets.water_l, 21);
});

test("period averages skip days without logged data and stay per day", () => {
  const model = buildDietChartModel({
    days: [
      day({ date: "2026-11-09", kcal: 2000, protein_g: 100, water_l: 2 }),
      day({ date: "2026-11-10", kcal: 2000, protein_g: 100, water_l: 2 }),
      day({ date: "2026-11-11", kcal: 2000, protein_g: 100, water_l: 2 }),
      day({ date: "2026-11-16", kcal: 1000, protein_g: 50, water_l: 1 }),
      day({ date: "2026-11-17", kcal: 1000, protein_g: 50, water_l: 1 }),
      day({ date: "2026-11-18", kcal: 1000, protein_g: 50, water_l: 1 }),
      day({ date: "2026-11-19", kcal: 1000, protein_g: 50, water_l: 1 }),
      day({ date: "2026-11-20", kcal: 1000, protein_g: 50, water_l: 1 }),
      day({ date: "2026-11-21", kcal: 1000, protein_g: 50, water_l: 1 }),
      day({ date: "2026-11-22", kcal: 1000, protein_g: 50, water_l: 1 }),
      day({ date: "2026-11-15", kcal: null, protein_g: 400, water_l: 0 }),
    ],
    weightRolling7: Array(11).fill(null),
    range: "6m",
    targets,
    goalWeightKg: 95,
  });

  assert.equal(model.weekly, true);
  assert.deepEqual(model.kcal, [6000, 7000]);
  assert.equal(model.averages.kcalPerDay, 1300);
  assert.equal(model.averages.kcalLine, 9100);
  assert.notEqual(model.averages.kcalLine, 6500);
  assert.equal(meanOfLogged([2000, null, 1000]), 1500);
  assert.equal(sumOfLogged([2000, null, 1000]), 3000);
  assert.equal(averageLineValue(1300, true), 9100);
  assert.equal(averageLineValue(1300, false), 1300);
  assert.equal(averageLineValue(null, true), null);
});

test("a partial week still uses the full weekly target", () => {
  const model = buildDietChartModel({
    days: [day({ date: "2026-11-13", kcal: 1800, protein_g: 140, water_l: 2.5, weight_kg: 99 })],
    weightRolling7: [104],
    range: "6m",
    targets,
    goalWeightKg: 95,
  });
  assert.deepEqual(model.kcal, [1800]);
  assert.equal(model.targets.calories_kcal, 14000);
  assert.equal(model.averages.kcalPerDay, 1800);
  assert.equal(model.averages.kcalLine, 12600);
  assert.equal(model.weightKg[0], 99);
  assert.equal(model.weightAvg7[0], 104);
});

test("cumulative lines keep history from before the selected window", () => {
  const model = buildDietChartModel({
    days: [
      day({
        date: "2026-10-01",
        kcal: 2000,
        whoop_burn_kcal: 2500,
        deficit_kcal: 500,
        cumulative_deficit_kcal: 500,
      }),
      day({
        date: "2026-11-13",
        kcal: 1800,
        whoop_burn_kcal: 2500,
        deficit_kcal: 700,
        cumulative_deficit_kcal: 1200,
      }),
    ],
    weightRolling7: [100, 99],
    range: "14d",
    targets,
    goalWeightKg: 95,
  });

  assert.deepEqual(model.labels, ["2026-11-13"]);
  assert.deepEqual(model.deficitWhoop, [1200]);
  assert.deepEqual(model.deficitFixed, [1600]);
});

test("an open today stays off the WHOOP line and the averages", () => {
  const model = buildDietChartModel({
    days: [
      day({ date: "2026-11-13", kcal: 2000, protein_g: 160, water_l: 3, whoop_burn_kcal: 2300, cycle_closed: true }),
      day({ date: "2026-11-14", kcal: 1800, protein_g: 150, water_l: 2, whoop_burn_kcal: 2200, cycle_closed: true }),
      day({
        date: "2026-11-15",
        kcal: 500,
        protein_g: 40,
        water_l: 0.5,
        whoop_burn_kcal: 120,
        cycle_closed: false,
      }),
    ],
    weightRolling7: [null, null, null],
    range: "14d",
    targets,
    goalWeightKg: 95,
    today: "2026-11-15",
  });

  assert.equal(isOpenToday({ date: "2026-11-15", cycle_closed: false }, "2026-11-15"), true);
  assert.equal(isOpenToday({ date: "2026-11-14", cycle_closed: false }, "2026-11-15"), false);
  assert.deepEqual(model.kcal, [2000, 1800, 500]);
  assert.deepEqual(model.whoopKcal, [2300, 2200, null]);
  assert.deepEqual(model.inProgress, [false, false, true]);
  assert.equal(model.openToday, true);
  assert.equal(model.averages.kcalPerDay, 1900);
  assert.equal(model.averages.proteinPerDay, 155);
  assert.equal(model.averages.waterPerDay, 2.5);
  assert.equal(model.averages.kcalLine, 1900);
});

test("a closed today counts toward the WHOOP line and the average", () => {
  const model = buildDietChartModel({
    days: [
      day({ date: "2026-11-14", kcal: 1800, protein_g: 140, water_l: 2, whoop_burn_kcal: 2100 }),
      day({
        date: "2026-11-15",
        kcal: 2000,
        protein_g: 170,
        water_l: 3,
        whoop_burn_kcal: 2400,
        cycle_closed: true,
      }),
    ],
    weightRolling7: [null, null],
    range: "14d",
    targets,
    goalWeightKg: 95,
    today: "2026-11-15",
  });

  assert.deepEqual(model.whoopKcal, [2100, 2400]);
  assert.equal(model.openToday, false);
  assert.equal(model.averages.kcalPerDay, 1900);
  assert.equal(model.averages.proteinPerDay, 155);
});

test("weekly totals keep today's food and drop an open WHOOP burn", () => {
  const model = buildDietChartModel({
    days: [
      day({ date: "2026-11-09", kcal: 2000, protein_g: 150, water_l: 3, whoop_burn_kcal: 2200, cycle_closed: true }),
      day({
        date: "2026-11-15",
        kcal: 400,
        protein_g: 30,
        water_l: 1,
        whoop_burn_kcal: 80,
        cycle_closed: false,
      }),
    ],
    weightRolling7: [null, null],
    range: "all",
    targets,
    goalWeightKg: 95,
    today: "2026-11-15",
  });

  assert.equal(model.weekly, true);
  assert.deepEqual(model.kcal, [2400]);
  assert.deepEqual(model.whoopKcal, [2200]);
  assert.deepEqual(model.inProgress, [true]);
  assert.equal(model.averages.kcalPerDay, 2000);
  assert.equal(model.averages.proteinPerDay, 150);
  assert.equal(model.averages.waterPerDay, 3);
});

test("average stat lines stay per day", () => {
  assert.equal(formatKcalPerDay(1842.4), "Avg 1,842 kcal/day");
  assert.equal(formatProteinPerDay(150.6), "Avg 151 g/day");
  assert.equal(formatWaterPerDay(2.55), "Avg 2.6 L/day");
  assert.equal(formatKcalPerDay(null), null);
  assert.equal(formatWaterPerDay(null), null);
});
