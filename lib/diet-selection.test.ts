import assert from "node:assert/strict";
import test from "node:test";
import { buildDietDashboardView } from "./data";
import { shiftIsoDate, todayIsoDate } from "./format";
import type { DayLog, FitnessSnapshot, FoodItem } from "./types";

function food(partial: Partial<FoodItem> & { item: string; kcal: number }): FoodItem {
  return {
    time: "08:00",
    protein_g: 10,
    carbs_g: 10,
    fat_g: 5,
    ...partial,
  };
}

function day(foods: FoodItem[]): DayLog {
  return {
    weight_kg: null,
    foods,
    calories_kcal: foods.reduce((sum, item) => sum + item.kcal, 0),
    water_l: 0,
    drinks: null,
    exercise: [],
    notes: null,
    complete: false,
    water_entries: [],
    whoop: null,
  };
}

function snapshot(days: Record<string, DayLog>): FitnessSnapshot {
  return {
    goal_weight_kg: 95,
    start_weight_kg: 104,
    start_date: "2026-11-01",
    targets: {
      calories_kcal: 2000,
      water_l: 3,
      fasting: "16:8",
      protein_g: 170,
      carbs_g: 185,
      fat_g: 65,
    },
    days,
    saved_meals: {},
    whoop: { cycles: [], recovery: [], sleep: [], workouts: [], updated_at: "" },
  };
}

test("the diet tab opens on Melbourne today, not a pre-logged tomorrow", () => {
  const today = todayIsoDate("Australia/Melbourne");
  const tomorrow = shiftIsoDate(today, 1);
  const yesterday = shiftIsoDate(today, -1);
  const view = buildDietDashboardView(
    snapshot({
      [yesterday]: day([
        food({ item: "Rice", kcal: 500 }),
        food({ item: "Cake (planned)", kcal: 300 }),
        food({ item: "Shake", kcal: 120, planned: true }),
      ]),
      [tomorrow]: day([food({ item: "Oats", kcal: 400 })]),
    }),
  );

  assert.equal(view.today.date, today);
  assert.equal(view.calendar_today, today);
  assert.equal(
    view.days.some((entry) => entry.date > today),
    false,
  );
  assert.equal(view.days.find((entry) => entry.date === yesterday)?.kcal, 500);
  assert.equal(view.tomorrow?.date, tomorrow);
  assert.equal(view.tomorrow?.kcal, 400);

  const planned = buildDietDashboardView(
    snapshot({
      [tomorrow]: day([food({ item: "Oats", kcal: 400, protein_g: 30 })]),
    }),
    tomorrow,
  );
  assert.equal(planned.today.date, tomorrow);
  assert.equal(planned.today.kcal, 400);
  assert.equal(planned.today.protein_g, 30);
  assert.equal(
    planned.days.some((entry) => entry.date === tomorrow),
    false,
  );
});
