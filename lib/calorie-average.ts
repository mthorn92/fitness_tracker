import { shiftIsoDate } from "@/lib/format";
import { activePhase, phaseDaysLeft, PHASES, type CaloriePhase } from "@/lib/phases";

export const MELBOURNE_TIME_ZONE = "Australia/Melbourne";

/** Calendar YYYY-MM-DD for an instant. Defaults to Melbourne. */
export function calendarIsoDate(instant: Date, timeZone = MELBOURNE_TIME_ZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

export type LoggedCalorieDay = {
  date: string;
  /**
   * Food calories for that day.
   * Null means nothing was logged and the day is skipped.
   * Zero still counts. WHOOP burn is not a field and never changes the target.
   */
  kcal: number | null;
};

export type CalorieAverage = {
  /** Nearest kcal, so the over/under figure matches the number on the tile. */
  averageKcal: number;
  /** Logged days that were included. Missing days are not counted. */
  days: number;
  targetKcal: number;
  /** averageKcal − targetKcal. Negative is under the target. */
  deltaKcal: number;
  status: "under" | "over" | "even";
};

function loggedKcalByDate(days: readonly LoggedCalorieDay[]): Map<string, number> {
  const byDate = new Map<string, number>();
  for (const day of days) {
    if (typeof day.kcal !== "number" || !Number.isFinite(day.kcal)) continue;
    byDate.set(day.date, day.kcal);
  }
  return byDate;
}

function averageFromValues(values: number[], targetKcal: number): CalorieAverage | null {
  if (values.length === 0 || !Number.isFinite(targetKcal)) return null;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const averageKcal = Math.round(mean);
  const deltaKcal = averageKcal - targetKcal;
  const status = deltaKcal > 0 ? "over" : deltaKcal < 0 ? "under" : "even";
  return { averageKcal, days: values.length, targetKcal, deltaKcal, status };
}

function valuesBetween(
  byDate: ReadonlyMap<string, number>,
  start: string,
  end: string,
): number[] {
  if (end < start) return [];
  const values: number[] = [];
  for (let date = start; date <= end; date = shiftIsoDate(date, 1)) {
    const kcal = byDate.get(date);
    if (kcal == null) continue;
    values.push(kcal);
  }
  return values;
}

/**
 * Mean food calories for the calendar window ending yesterday.
 * Today is never included, even when food is already logged.
 * A day with no food is skipped. The window does not stretch back to replace it.
 */
export function rollingCalorieAverage(
  days: readonly LoggedCalorieDay[],
  today: string,
  targetKcal: number,
  windowDays = 7,
): CalorieAverage | null {
  if (windowDays < 1) return null;
  const start = shiftIsoDate(today, -windowDays);
  const end = shiftIsoDate(today, -1);
  return averageFromValues(valuesBetween(loggedKcalByDate(days), start, end), targetKcal);
}

/**
 * Mean food calories on completed days inside one phase.
 * Today is excluded. Days outside the phase, and days with no food, are skipped.
 */
export function phaseCalorieAverage(
  days: readonly LoggedCalorieDay[],
  today: string,
  phase: CaloriePhase,
): CalorieAverage | null {
  const yesterday = shiftIsoDate(today, -1);
  if (yesterday < phase.start) return null;
  const end = yesterday < phase.end ? yesterday : phase.end;
  return averageFromValues(
    valuesBetween(loggedKcalByDate(days), phase.start, end),
    phase.kcal_target,
  );
}

export type PhaseCalorieSummary = {
  phase: CaloriePhase;
  /** Days from today through phase.end, counting both. Last day is 1. */
  daysLeft: number;
  average: CalorieAverage | null;
};

/** Active phase for today, or null when today sits outside every phase. */
export function phaseCalorieSummary(
  days: readonly LoggedCalorieDay[],
  today: string,
  phases: readonly CaloriePhase[] = PHASES,
): PhaseCalorieSummary | null {
  const phase = activePhase(today, phases);
  if (!phase) return null;
  return {
    phase,
    daysLeft: phaseDaysLeft(today, phase),
    average: phaseCalorieAverage(days, today, phase),
  };
}
