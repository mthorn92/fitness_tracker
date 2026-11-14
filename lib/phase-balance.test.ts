import assert from "node:assert/strict";
import test from "node:test";
import { KCAL_PER_KG } from "./deficit";
import {
  activePhaseFoodBalance,
  formatPhaseRange,
  phaseFoodBalance,
  type PhaseFoodDay,
} from "./phase-balance";
import { PHASES, type CaloriePhase } from "./phases";

const phase1 = PHASES[0];

test("Phase 1 dates read 9 Nov to 22 Dec", () => {
  assert.equal(formatPhaseRange(phase1), "9 Nov to 22 Dec");
});

test("a phase that crosses a year keeps both years", () => {
  const maintenance: CaloriePhase = {
    name: "Break",
    start: "2026-12-23",
    end: "2027-01-04",
    kcal_target: 2500,
  };
  assert.equal(formatPhaseRange(maintenance), "23 Dec 2026 to 4 Jan 2027");
});

test("food deficit uses completed logged days and the phase target", () => {
  const days: PhaseFoodDay[] = [
    { date: "2026-11-08", kcal: 3000 },
    { date: "2026-11-09", kcal: 1800 },
    { date: "2026-11-10", kcal: null },
    { date: "2026-11-11", kcal: 0 },
    { date: "2026-11-14", kcal: 2500, cycleClosed: false },
    { date: "2026-11-15", kcal: 1000 },
  ];
  const balance = activePhaseFoodBalance(days, "2026-11-14");

  assert.equal(balance?.phase.name, "Phase 1");
  assert.equal(balance?.loggedDays, 2);
  assert.equal(balance?.foodKcal, 1800);
  assert.equal(balance?.deficitKcal, 2200);
  assert.equal(balance?.deficitKg, 2200 / KCAL_PER_KG);
  assert.equal(balance?.countsToday, false);
});

test("a closed today is counted, and a duplicate day is not", () => {
  const balance = phaseFoodBalance(
    [
      { date: "2026-11-13", kcal: 1900 },
      { date: "2026-11-13", kcal: 9999 },
      { date: "2026-11-14", kcal: 2100, complete: true },
    ],
    "2026-11-14",
    phase1,
  );

  assert.equal(balance.loggedDays, 2);
  assert.equal(balance.foodKcal, 4000);
  assert.equal(balance.deficitKcal, 0);
  assert.equal(balance.countsToday, true);
});

test("an open first day has no deficit yet", () => {
  const balance = activePhaseFoodBalance(
    [{ date: "2026-11-09", kcal: 1800 }],
    "2026-11-09",
  );
  assert.equal(balance?.loggedDays, 0);
  assert.equal(balance?.deficitKcal, 0);
  assert.equal(balance?.countsToday, false);
});

test("a later phase uses its own target instead of 2,000", () => {
  const maintenance: CaloriePhase = {
    name: "Break",
    start: "2026-12-23",
    end: "2027-01-04",
    kcal_target: 2500,
  };
  const phases = [...PHASES, maintenance];
  const balance = activePhaseFoodBalance(
    [{ date: "2026-12-24", kcal: 2600 }],
    "2026-12-25",
    phases,
  );

  assert.equal(balance?.phase.name, "Break");
  assert.equal(balance?.loggedDays, 1);
  assert.equal(balance?.deficitKcal, -100);
  assert.equal(balance?.deficitKg, -100 / KCAL_PER_KG);
});

test("outside every phase there is no balance", () => {
  assert.equal(activePhaseFoodBalance([{ date: "2026-12-21", kcal: 1800 }], "2026-12-23"), null);
  assert.equal(activePhaseFoodBalance([{ date: "2026-11-08", kcal: 2500 }], "2026-11-08"), null);
});
