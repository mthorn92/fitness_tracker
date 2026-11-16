import assert from "node:assert/strict";
import test from "node:test";
import { formatActual } from "./exercise-progress";
import type { PrescribedExercise, SessionSet } from "./types";

test("actualText shows uniform reps, load, and bands", () => {
  const bench = item({ key: "bench_press", sets: 3, reps: 7, load_kg: 50 });
  const uniform = sets([
    { set: 1, reps: 7, load_kg: 50 },
    { set: 2, reps: 7, load_kg: 50 },
    { set: 3, reps: 7, load_kg: 50 },
  ]);
  assert.equal(formatActual(uniform, bench).text, "3×7 @ 50 kg");

  const banded = item({ key: "banded_pullup", sets: 3, reps: 6, band: "2 red" });
  const bandSets = sets([
    { set: 1, reps: 6, band: "2 red" },
    { set: 2, reps: 6, band: "2 red" },
    { set: 3, reps: 6, band: "2 red" },
  ]);
  assert.equal(formatActual(bandSets, banded).text, "3×6 · 2 red bands");
});

test("actualText lists mixed reps, loads, and bands", () => {
  const raise = item({ key: "db_lateral_raise", sets: 3, reps: 10, load_kg: 8 });
  const mixedReps = sets([
    { set: 1, reps: 20, load_kg: 8 },
    { set: 2, reps: 20, load_kg: 8 },
    { set: 3, reps: 10, load_kg: 8 },
  ]);
  assert.equal(formatActual(mixedReps, raise).text, "20/20/10 @ 8 kg");

  const pushdown = item({ key: "rope_pushdown", sets: 3, reps: 10 });
  const mixedLoad = sets([
    { set: 1, reps: 10, load_kg: 25 },
    { set: 2, reps: 10, load_kg: 25 },
    { set: 3, reps: 10, load_kg: 35 },
  ]);
  assert.equal(formatActual(mixedLoad, pushdown).text, "10/10/10 @ 25/25/35");

  const pull = item({ key: "banded_pullup", sets: 3, reps: 6, band: "2 red" });
  const mixedBand = sets([
    { set: 1, reps: 6, band: "2 red" },
    { set: 2, reps: 6, band: "2 red" },
    { set: 3, reps: 5, band: "1 red" },
  ]);
  assert.equal(formatActual(mixedBand, pull).text, "6/6/5 · 2 red/2 red/1 red");
});

function item(partial: Partial<PrescribedExercise> & Pick<PrescribedExercise, "key">): PrescribedExercise {
  return {
    name: partial.key,
    sets: partial.sets ?? 3,
    reps: partial.reps ?? 10,
    reps_max: null,
    load_kg: partial.load_kg ?? null,
    load_kg_min: null,
    load_kg_max: null,
    hold_s: null,
    band: partial.band ?? null,
    extra: null,
    group: null,
    muscle_group: "arms",
    progression: "none",
    ...partial,
  };
}

function sets(
  rows: Array<{
    set: number;
    reps?: number;
    load_kg?: number | null;
    band?: string | null;
  }>,
): SessionSet[] {
  return rows.map((row) => ({
    exercise_key: "x",
    set: row.set,
    reps: row.reps ?? null,
    load_kg: row.load_kg ?? null,
    band: row.band ?? null,
    hold_s: null,
    done: true,
  }));
}