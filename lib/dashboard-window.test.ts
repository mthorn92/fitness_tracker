import assert from "node:assert/strict";
import test from "node:test";
import { buildDietDashboardView, buildTodayView } from "./data";
import { shiftIsoDate } from "./format";
import { dashboardDateBounds, loadSnapshot } from "./store";

process.env.FITNESS_PGLITE_MEMORY = "1";
delete process.env.DATABASE_URL;

test("the selected chart window keeps meals and the running deficit", async () => {
  const bounds = await dashboardDateBounds();
  const full = await loadSnapshot();
  const ranged = await loadSnapshot({
    from: shiftIsoDate(bounds.latest, -13),
    to: bounds.latest,
  });
  const fullView = buildDietDashboardView(full);
  const rangedView = buildDietDashboardView(ranged);
  assert.equal(rangedView.today.date, fullView.today.date);
  assert.equal(rangedView.today.kcal, fullView.today.kcal);
  assert.equal(rangedView.cumulative_deficit_kcal, fullView.cumulative_deficit_kcal);
  assert.equal(rangedView.days.length, fullView.days.length);
  const fullLog = buildTodayView(full, fullView.today.date);
  const rangedLog = buildTodayView(ranged, rangedView.today.date);
  assert.deepEqual(
    rangedLog.foods.map((food) => food.id),
    fullLog.foods.map((food) => food.id),
  );
  assert.equal(rangedLog.foods.some((food) => food.id?.startsWith("agg:")), false);
});
