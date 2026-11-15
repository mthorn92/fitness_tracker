import type { MuscleGroup, PrescribedExercise, SessionSet } from "@/lib/types";

export const MUSCLE_GROUPS: MuscleGroup[] = ["legs", "back", "chest", "shoulders", "arms"];

export type DoneStatus = "met" | "partial" | "none";

export function formatCount(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function formatTarget(item: PrescribedExercise): string {
  if (item.extra === "attempt") return `${item.sets} attempts`;
  const dose = item.hold_s != null ? holdDose(item) : repDose(item);
  const load = loadText(item);
  const band = item.band ? ` · ${formatBand(item.band)}` : "";
  const box = item.extra === "low box" ? " · low box" : "";
  return `${dose}${load}${band}${box}`;
}

export function formatActual(
  sets: SessionSet[],
  item: PrescribedExercise,
): { text: string | null; status: DoneStatus } {
  const done = sets.filter((set) => set.done).sort((a, b) => a.set - b.set);
  if (done.length === 0) return { text: null, status: "none" };
  const status: DoneStatus = done.filter((set) => setMeets(set, item)).length >= item.sets ? "met" : "partial";
  return { text: actualText(done, item), status };
}

/** Epley: load × (1 + reps / 30). */
export function epley(loadKg: number, reps: number): number {
  return loadKg * (1 + reps / 30);
}

export function bestEpley(sets: SessionSet[]): number | null {
  let best: number | null = null;
  for (const set of sets) {
    if (!set.done || set.load_kg == null || set.load_kg <= 0 || set.reps == null || set.reps <= 0) continue;
    const value = epley(set.load_kg, set.reps);
    if (best == null || value > best) best = value;
  }
  return best;
}

/** Weekly work. Loaded sets contribute load × reps. Banded pull-ups contribute reps. */
export function setWork(set: SessionSet): number {
  if (!set.done) return 0;
  const reps = set.reps ?? 0;
  if (reps <= 0) return 0;
  if (set.exercise_key === "banded_pullup") return reps;
  const load = set.load_kg ?? 0;
  if (load <= 0) return 0;
  return load * reps;
}

export function emptyWork(): Record<MuscleGroup, number> {
  return { chest: 0, shoulders: 0, back: 0, legs: 0, arms: 0 };
}

function holdDose(item: PrescribedExercise): string {
  return `${item.sets} × ${formatCount(item.hold_s ?? 0)}s`;
}

function repDose(item: PrescribedExercise): string {
  const reps =
    item.reps_max != null && item.reps_max !== item.reps
      ? `${formatCount(item.reps)}–${formatCount(item.reps_max)}`
      : formatCount(item.reps);
  const suffix = item.extra === "per leg" ? " / leg" : item.extra === "per side" ? " / side" : "";
  return `${item.sets} × ${reps}${suffix}`;
}

function loadText(item: PrescribedExercise): string {
  if (item.load_kg != null) {
    const hand = item.extra === "per hand" ? "/hand" : "";
    return ` @ ${formatCount(item.load_kg)} kg${hand}`;
  }
  if (item.load_kg_min != null && item.load_kg_max != null) {
    return ` · ${formatCount(item.load_kg_min)}–${formatCount(item.load_kg_max)} kg`;
  }
  return "";
}

function formatBand(band: string): string {
  if (band === "bodyweight") return "bodyweight";
  const match = /^(\d+) red$/.exec(band);
  if (!match) return band;
  return `${match[1]} red ${match[1] === "1" ? "band" : "bands"}`;
}

function setMeets(set: SessionSet, item: PrescribedExercise): boolean {
  if (item.hold_s != null) return (set.hold_s ?? 0) >= item.hold_s;
  if ((set.reps ?? 0) < item.reps) return false;
  if (item.load_kg != null && (set.load_kg ?? 0) + 1e-9 < item.load_kg) return false;
  return true;
}

function actualText(done: SessionSet[], item: PrescribedExercise): string {
  const timed = item.hold_s != null;
  const sameHold = done.every((set) => set.hold_s === done[0]?.hold_s);
  const sameReps = done.every((set) => set.reps === done[0]?.reps);
  const sameLoad = done.every((set) => set.load_kg === done[0]?.load_kg);
  if (timed && sameHold && done[0]?.hold_s != null) {
    return `${done.length}×${formatCount(done[0].hold_s)}s`;
  }
  if (!timed && sameReps && sameLoad && done[0]?.reps != null) {
    const load = done[0].load_kg != null && done[0].load_kg > 0 ? ` @ ${formatCount(done[0].load_kg)}` : "";
    return `${done.length}×${formatCount(done[0].reps)}${load}`;
  }
  if (timed) {
    return done.map((set) => (set.hold_s == null ? "—" : `${formatCount(set.hold_s)}s`)).join(", ");
  }
  return done.map((set) => (set.reps == null ? "—" : formatCount(set.reps))).join(", ");
}
