import assert from "node:assert/strict";
import test from "node:test";
import sampleData from "../data/fitness.json";
import { preferredWhoopBurnKcal } from "./whoop-burn";

const MONDAY = "2026-11-09";

test("flat equal to the day_whoop snapshot wins over a lower cycle", () => {
  assert.equal(preferredWhoopBurnKcal(2219, 1372, 2219), 2219);
});

test("a flat override that differs from the snapshot wins", () => {
  assert.equal(preferredWhoopBurnKcal(2500, 2200, 1800), 2500);
});

test("no posted burn falls back to the cycle", () => {
  assert.equal(preferredWhoopBurnKcal(null, 1372, null), 1372);
  assert.equal(preferredWhoopBurnKcal(undefined, 2338, undefined), 2338);
});

test("day_whoop snapshot wins over a cycle when the flat copy is missing", () => {
  assert.equal(preferredWhoopBurnKcal(null, 1372, 2219), 2219);
});

test("falls back to the stored burn when no cycle is synced", () => {
  assert.equal(preferredWhoopBurnKcal(2219, null, 2219), 2219);
  assert.equal(preferredWhoopBurnKcal(null, null, 2219), 2219);
});

test("nothing yields null", () => {
  assert.equal(preferredWhoopBurnKcal(null, null, null), null);
  assert.equal(preferredWhoopBurnKcal(undefined, undefined, undefined), null);
});

test("seeded sample cycle is not used once a posted burn exists for that date", () => {
  const cycle = sampleData.whoop.cycles.find((row) => row.waking_date === MONDAY);
  const seededDay = sampleData.days[MONDAY]?.whoop;
  assert.ok(cycle);
  assert.equal(cycle.end, null);
  assert.equal(cycle.kcal, 1372);
  assert.ok(Math.abs(cycle.strain - 0.86374724) < 1e-6);
  assert.equal(seededDay?.kcal, 1372);
  // Diet Coach's closed-cycle POST. Load copies it onto flat and day_whoop.
  assert.equal(preferredWhoopBurnKcal(2219, cycle.kcal, 2219), 2219);
});
