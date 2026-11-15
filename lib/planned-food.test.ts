import assert from "node:assert/strict";
import test from "node:test";
import { isPlannedFood, nameMarkedPlanned } from "./planned-food";

test("a future date, the flag, or a (planned) name marks food as planned", () => {
  assert.equal(nameMarkedPlanned("Oats (planned)"), true);
  assert.equal(nameMarkedPlanned("Oats (Planned)"), true);
  assert.equal(nameMarkedPlanned("Oats"), false);

  const today = "2026-11-15";
  assert.equal(isPlannedFood({ item: "Oats", planned: true }, today, today), true);
  assert.equal(isPlannedFood({ item: "Oats (planned)" }, today, today), true);
  assert.equal(isPlannedFood({ item: "Oats" }, "2026-11-16", today), true);
  assert.equal(isPlannedFood({ item: "Oats", planned: false }, today, today), false);
  assert.equal(isPlannedFood({ item: "Oats" }, "2026-11-14", today), false);
});
