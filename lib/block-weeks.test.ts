import assert from "node:assert/strict";
import test from "node:test";
import { blockWeekForDate, blockWeekRange } from "./block-weeks";
import { loadTrainingPlan } from "./plan";

const active = loadTrainingPlan();

test("5-week block weeks align to Melbourne Mon–Sun after a Saturday start", () => {
  assert.equal(blockWeekForDate("2026-11-15", active), 1);
  assert.equal(blockWeekForDate("2026-11-22", active), 1);
  assert.equal(blockWeekForDate("2026-11-23", active), 2);
  assert.equal(blockWeekForDate("2026-11-30", active), 3);
  assert.equal(blockWeekForDate("2026-12-07", active), 4);
  assert.equal(blockWeekForDate("2026-12-14", active), 5);
  assert.equal(blockWeekForDate("2026-12-22", active), 5);

  assert.deepEqual(blockWeekRange(1, active), { start: "2026-11-15", end: "2026-11-22" });
  assert.deepEqual(blockWeekRange(2, active), { start: "2026-11-23", end: "2026-11-29" });
  assert.deepEqual(blockWeekRange(5, active), { start: "2026-12-14", end: "2026-12-22" });
});