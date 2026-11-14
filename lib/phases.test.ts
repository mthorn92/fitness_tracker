import assert from "node:assert/strict";
import test from "node:test";
import { phaseCalorieAverage, phaseCalorieSummary } from "./calorie-average";
import { PHASES, activePhase, phaseDaysLeft, type CaloriePhase } from "./phases";

const phase1 = PHASES[0];

test("Phase 1 is the 2,000 kcal block from 9 Nov through 22 Dec", () => {
  assert.equal(PHASES.length, 1);
  assert.deepEqual(phase1, {
    name: "Phase 1",
    start: "2026-11-09",
    end: "2026-12-22",
    kcal_target: 2000,
  });
});

test("days left counts today through 22 Dec, including both", () => {
  assert.equal(activePhase("2026-11-14")?.name, "Phase 1");
  assert.equal(phaseDaysLeft("2026-11-14", phase1), 39);
  assert.equal(phaseDaysLeft("2026-11-09", phase1), 44);
});

test("the last day of Phase 1 is still one day left and today is not averaged", () => {
  const today = "2026-12-22";
  const summary = phaseCalorieSummary(
    [
      { date: "2026-12-21", kcal: 1800 },
      { date: "2026-12-22", kcal: 3000 },
    ],
    today,
  );

  assert.equal(activePhase(today)?.name, "Phase 1");
  assert.equal(phaseDaysLeft(today, phase1), 1);
  assert.equal(summary?.daysLeft, 1);
  assert.equal(summary?.average?.days, 1);
  assert.equal(summary?.average?.averageKcal, 1800);
  assert.equal(summary?.average?.targetKcal, 2000);
  assert.equal(summary?.average?.status, "under");
});

test("after Phase 1 ends there is no phase line", () => {
  assert.equal(activePhase("2026-12-23"), null);
  assert.equal(phaseDaysLeft("2026-12-23", phase1), 0);
  assert.equal(
    phaseCalorieSummary([{ date: "2026-12-21", kcal: 1800 }], "2026-12-23"),
    null,
  );
});

test("before Phase 1 starts there is no phase line", () => {
  assert.equal(activePhase("2026-11-08"), null);
  assert.equal(phaseCalorieSummary([{ date: "2026-11-08", kcal: 2500 }], "2026-11-08"), null);
});

test("phase average uses completed logged days inside the phase only", () => {
  const average = phaseCalorieAverage(
    [
      { date: "2026-11-08", kcal: 3000 },
      { date: "2026-11-09", kcal: 1800 },
      { date: "2026-11-10", kcal: null },
      { date: "2026-11-11", kcal: 2200 },
      { date: "2026-11-14", kcal: 2500 },
      { date: "2026-11-15", kcal: 900 },
    ],
    "2026-11-14",
    phase1,
  );

  assert.equal(average?.days, 2);
  assert.equal(average?.averageKcal, 2000);
  assert.equal(average?.targetKcal, 2000);
  assert.equal(average?.deltaKcal, 0);
  assert.equal(average?.status, "even");
});

test("a later phase can be added without changing Phase 1", () => {
  const maintenance: CaloriePhase = {
    name: "Break",
    start: "2026-12-23",
    end: "2027-01-04",
    kcal_target: 2500,
  };
  const phases = [...PHASES, maintenance];

  assert.equal(activePhase("2026-11-14", phases)?.name, "Phase 1");
  assert.equal(activePhase("2026-12-25", phases)?.name, "Break");
  assert.equal(activePhase("2027-01-05", phases), null);

  const average = phaseCalorieAverage(
    [{ date: "2026-12-24", kcal: 2600 }],
    "2026-12-25",
    maintenance,
  );
  assert.equal(average?.averageKcal, 2600);
  assert.equal(average?.targetKcal, 2500);
  assert.equal(average?.status, "over");
  assert.equal(phaseDaysLeft("2026-12-25", maintenance), 11);
});
