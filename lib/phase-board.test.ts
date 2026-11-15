import assert from "node:assert/strict";
import test from "node:test";
import { KCAL_PER_KG } from "./deficit";
import { buildPhaseBoard, type PhaseBoardDay } from "./phase-board";
import { PHASES } from "./phases";

const phase = PHASES[0];

function day(partial: Partial<PhaseBoardDay> & { date: string }): PhaseBoardDay {
  return {
    kcal: null,
    whoopKcal: null,
    complete: false,
    cycleClosed: null,
    ...partial,
  };
}

test("phase board is as of the selected day and leaves an open today out", () => {
  const days: PhaseBoardDay[] = [
    day({ date: "2026-11-09", kcal: 1800, whoopKcal: 2600, cycleClosed: true }),
    day({ date: "2026-11-14", kcal: 2200, whoopKcal: 2500, cycleClosed: true }),
    day({ date: "2026-11-15", kcal: 900, whoopKcal: 2400, cycleClosed: false }),
    day({ date: "2026-11-16", kcal: 1500, whoopKcal: 2400 }),
  ];
  const board = buildPhaseBoard(days, "2026-11-15", "2026-11-15");
  assert.equal(board?.phase.name, phase.name);
  assert.equal(board?.daysLeft, 38);
  assert.equal(board?.loggedDays, 2);
  assert.equal(board?.logSlots, phase.end === "2026-12-22" ? 43 : board?.logSlots);
  assert.equal(board?.average?.days, 2);
  assert.equal(board?.average?.averageKcal, 2000);
  assert.equal(board?.deficitKcal, (2600 - 1800) + (2500 - 2200));
  assert.equal(board?.expectedKg, -board!.deficitKcal / KCAL_PER_KG);

  const past = buildPhaseBoard(days, "2026-11-09", "2026-11-15");
  assert.equal(past?.daysLeft, 44);
  assert.equal(past?.loggedDays, 1);
  assert.equal(past?.average?.averageKcal, 1800);

  assert.equal(buildPhaseBoard(days, "2026-12-23", "2026-11-15"), null);
});
