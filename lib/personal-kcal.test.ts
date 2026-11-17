import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPersonalKcalModel,
  PERSONAL_KCAL_REFERENCE,
  PERSONAL_ROLLING_FROM_DAY,
  ratioKcalPerKg,
} from "./personal-kcal";

const PHASE_START = "2026-11-09";
const TODAY = "2026-11-16";

function closedDay(
  date: string,
  weight_kg: number,
  whoop: number,
  food: number,
): {
  date: string;
  weight_kg: number;
  whoop_burn_kcal: number;
  kcal: number;
  cycle_closed: true;
  complete: true;
} {
  return {
    date,
    weight_kg,
    whoop_burn_kcal: whoop,
    kcal: food,
    cycle_closed: true,
    complete: true,
  } as const;
}

test("ratioKcalPerKg guards zero and negative loss", () => {
  assert.equal(ratioKcalPerKg(7700, 0), null);
  assert.equal(ratioKcalPerKg(7700, -0.2), null);
  assert.equal(ratioKcalPerKg(7700, 1), 7700);
});

test("hero uses cumulative deficit over closed days and 7-day average weight loss", () => {
  const days = [
    closedDay(PHASE_START, 100, 2800, 2000),
    closedDay("2026-11-10", 99.8, 2800, 2000),
    closedDay("2026-11-11", 99.5, 2800, 2000),
    closedDay("2026-11-12", 99.3, 2800, 2000),
    closedDay("2026-11-13", 99.1, 2800, 2000),
    closedDay("2026-11-14", 98.9, 2800, 2000),
    closedDay("2026-11-15", 98.7, 2800, 2000),
    closedDay(TODAY, 98.5, 2800, 2000),
  ];
  const model = buildPersonalKcalModel(days, TODAY);
  assert.ok(model);
  assert.equal(model.closedDays, 8);
  assert.ok(model.heroKcalPerKg != null && model.heroKcalPerKg > 0);
  assert.equal(model.points.length, 8);
  assert.equal(model.points[0]?.rolling, null);
  assert.equal(model.points[1]?.rolling, null);
  assert.ok(model.points[2]?.rolling != null);
  assert.equal(model.settleLabel, "Settling · 8/14");
  const rollingSeries = model.points
    .map((point) => point.rolling)
    .filter((value): value is number => value != null && Number.isFinite(value));
  assert.ok(rollingSeries.length > 0, "chart rolling series must be non-empty for fixture window");
});

test("rolling line begins on the third closed day", () => {
  const days = [
    closedDay(PHASE_START, 100, 2700, 2000),
    closedDay("2026-11-10", 99.9, 2700, 2000),
    closedDay("2026-11-11", 99.8, 2700, 2000),
  ];
  const model = buildPersonalKcalModel(days, "2026-11-11");
  assert.equal(model?.points.length, 3);
  assert.equal(model?.points.filter((point) => point.rolling != null).length, 1);
  assert.equal(model?.points[PERSONAL_ROLLING_FROM_DAY - 1]?.rolling != null, true);
});

test("non-positive weight loss yields em dash hero", () => {
  const days = [closedDay(PHASE_START, 100, 2700, 2000), closedDay("2026-11-10", 100.2, 2700, 2000)];
  const model = buildPersonalKcalModel(days, "2026-11-10");
  assert.equal(model?.heroKcalPerKg, null);
});

test("reference constant stays at 7700", () => {
  assert.equal(PERSONAL_KCAL_REFERENCE, 7700);
});