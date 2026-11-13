import { formatNumber, formatShortDate, shiftIsoDate } from "@/lib/format";
import { loadSnapshot } from "@/lib/store";
import type { ExerciseEntry } from "@/lib/types";

/** Seven calendar days ending on `endDate`, including that day. */
export const WHOOP_WINDOW_DAYS = 7;

export type WhoopWorkoutRow = {
  id: string;
  date: string;
  dateLabel: string;
  name: string;
  durationLabel: string;
  strainLabel: string;
  hrLabel: string;
  kcalLabel: string;
};

export type WhoopWorkoutsModel = {
  rows: WhoopWorkoutRow[];
  /** Null when there are no workouts in the window. */
  summary: string | null;
};

type DayExercises = {
  exercise?: ExerciseEntry[];
};

/**
 * A logged exercise belongs on this tile when Diet Coach marked it `whoop`,
 * or when it has no source at all. Any other source stays off the tile.
 */
export function isWhoopWorkout(entry: Pick<ExerciseEntry, "source">): boolean {
  const source = entry.source?.trim().toLowerCase() ?? "";
  return source === "" || source === "whoop";
}

export function whoopWindowStart(endDate: string): string {
  return shiftIsoDate(endDate, -(WHOOP_WINDOW_DAYS - 1));
}

export function whoopWorkoutsModel(
  days: Record<string, DayExercises | undefined>,
  endDate: string,
): WhoopWorkoutsModel {
  const start = whoopWindowStart(endDate);
  const picked: Array<ExerciseEntry & { date: string }> = [];
  for (const [date, day] of Object.entries(days)) {
    if (date < start || date > endDate) continue;
    for (const entry of day?.exercise ?? []) {
      if (!isWhoopWorkout(entry)) continue;
      picked.push({ ...entry, date });
    }
  }
  picked.sort(newestFirst);
  if (picked.length === 0) return { rows: [], summary: null };
  return {
    rows: picked.map((entry, index) => toRow(entry, index)),
    summary: summarize(picked),
  };
}

export async function getWhoopWorkouts(endDate: string): Promise<WhoopWorkoutsModel> {
  const snapshot = await loadSnapshot();
  return whoopWorkoutsModel(snapshot.days, endDate);
}

export function formatDurationMin(minutes: number | null | undefined): string {
  if (minutes == null || !Number.isFinite(minutes) || minutes < 0) return "—";
  const total = Math.round(minutes);
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours > 0) return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  return `${mins} min`;
}

export function formatStrain(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return formatNumber(value, 1);
}

export function formatAvgHr(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${Math.round(value)} bpm`;
}

export function formatWorkoutKcal(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${formatNumber(value)} kcal`;
}

function toRow(entry: ExerciseEntry & { date: string }, index: number): WhoopWorkoutRow {
  const name = entry.item.trim() || "Workout";
  return {
    id: entry.id?.trim() || `${entry.date}:${entry.time ?? ""}:${name}:${index}`,
    date: entry.date,
    dateLabel: formatShortDate(entry.date),
    name,
    durationLabel: formatDurationMin(entry.duration_min),
    strainLabel: formatStrain(entry.strain),
    hrLabel: formatAvgHr(entry.avg_hr),
    kcalLabel: formatWorkoutKcal(entry.kcal),
  };
}

function summarize(entries: Array<ExerciseEntry & { date: string }>): string {
  const count = entries.length;
  const workouts = count === 1 ? "1 workout" : `${count} workouts`;
  const minutes = entries.reduce((sum, entry) => {
    const value = entry.duration_min;
    return sum + (value != null && Number.isFinite(value) && value > 0 ? value : 0);
  }, 0);
  const kcal = entries.reduce((sum, entry) => {
    return sum + (Number.isFinite(entry.kcal) ? entry.kcal : 0);
  }, 0);
  const strains = entries.flatMap((entry) =>
    entry.strain != null && Number.isFinite(entry.strain) ? [entry.strain] : [],
  );
  const average = strains.length === 0 ? null : strains.reduce((sum, value) => sum + value, 0) / strains.length;
  return `${workouts} · ${formatDurationMin(minutes)} · ${formatWorkoutKcal(kcal)} · avg strain ${formatStrain(average)}`;
}

function newestFirst(a: ExerciseEntry & { date: string }, b: ExerciseEntry & { date: string }): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  const aTime = a.time ?? "";
  const bTime = b.time ?? "";
  if (aTime !== bTime) return aTime < bTime ? 1 : -1;
  const aId = a.id ?? "";
  const bId = b.id ?? "";
  if (aId === bId) return 0;
  return aId < bId ? 1 : -1;
}
