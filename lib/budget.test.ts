import assert from "node:assert/strict";
import test from "node:test";
import { dayBudget } from "./budget";

test("exercise is displayed without changing remaining calories", () => {
  const day = dayBudget(2000, 499, 663);
  assert.equal(day.foodKcal, 499);
  assert.equal(day.exerciseKcal, 663);
  assert.equal(day.remainingKcal, 1501);
  assert.equal(day.underBudget, true);
});

test("a workout day with no food stays at the food budget", () => {
  const day = dayBudget(2000, 0, 663);
  assert.equal(day.exerciseKcal, 663);
  assert.equal(day.remainingKcal, 2000);
  assert.equal(day.underBudget, true);
});

test("going over is food vs target only", () => {
  const day = dayBudget(2000, 2300, 500);
  assert.equal(day.remainingKcal, -300);
  assert.equal(day.underBudget, false);
});
