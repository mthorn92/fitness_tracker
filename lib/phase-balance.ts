import { KCAL_PER_KG } from "@/lib/deficit";
import { parseIsoDate } from "@/lib/format";
import { activePhase, PHASES, type CaloriePhase } from "@/lib/phases";

export type PhaseFoodDay = {
  date: string;
  /** Null means nothing was logged. Zero still counts. */
  kcal: number | null;
  complete?: boolean;
  cycleClosed?: boolean | null;
};

export type PhaseFoodBalance = {
  phase: CaloriePhase;
  /** Logged days inside the phase that count toward the food deficit. */
  loggedDays: number;
  foodKcal: number;
  /**
   * phase.kcal_target × loggedDays − foodKcal.
   * Positive means under the phase budget.
   */
  deficitKcal: number;
  /** deficitKcal / 7,700. */
  deficitKg: number;
  /** True when today's own food is included. An open today is not. */
  countsToday: boolean;
};

function dayClosed(day: PhaseFoodDay): boolean {
  return day.cycleClosed === true || day.complete === true;
}

function countsForBalance(day: PhaseFoodDay, today: string, phase: CaloriePhase): boolean {
  if (day.date < phase.start || day.date > phase.end) return false;
  if (typeof day.kcal !== "number" || !Number.isFinite(day.kcal)) return false;
  if (day.date > today) return false;
  if (day.date < today) return true;
  return dayClosed(day);
}

/**
 * Food logged against the phase budget.
 * Days before today count when food was logged. Today counts only once the day
 * is closed, the same rule as the cumulative deficit chart. The target comes
 * from the phase, so a later phase does not keep using 2,000.
 */
export function phaseFoodBalance(
  days: readonly PhaseFoodDay[],
  today: string,
  phase: CaloriePhase,
): PhaseFoodBalance {
  const seen = new Set<string>();
  let loggedDays = 0;
  let foodKcal = 0;
  let countsToday = false;
  for (const day of days) {
    if (seen.has(day.date) || !countsForBalance(day, today, phase)) continue;
    seen.add(day.date);
    loggedDays += 1;
    foodKcal += day.kcal as number;
    if (day.date === today) countsToday = true;
  }
  const deficitKcal = phase.kcal_target * loggedDays - foodKcal;
  return {
    phase,
    loggedDays,
    foodKcal,
    deficitKcal,
    deficitKg: deficitKcal / KCAL_PER_KG,
    countsToday,
  };
}

export function activePhaseFoodBalance(
  days: readonly PhaseFoodDay[],
  today: string,
  phases: readonly CaloriePhase[] = PHASES,
): PhaseFoodBalance | null {
  const phase = activePhase(today, phases);
  if (!phase) return null;
  return phaseFoodBalance(days, today, phase);
}

function phaseDayParts(iso: string): { day: string; month: string; year: string } {
  const date = parseIsoDate(iso);
  return {
    day: new Intl.DateTimeFormat("en-AU", { day: "numeric", timeZone: "UTC" }).format(date),
    month: new Intl.DateTimeFormat("en-AU", { month: "short", timeZone: "UTC" }).format(date),
    year: new Intl.DateTimeFormat("en-AU", { year: "numeric", timeZone: "UTC" }).format(date),
  };
}

/** "9 Nov to 22 Dec", or with years when the phase crosses a year. */
export function formatPhaseRange(phase: CaloriePhase): string {
  const start = phaseDayParts(phase.start);
  const end = phaseDayParts(phase.end);
  if (start.year === end.year) return `${start.day} ${start.month} to ${end.day} ${end.month}`;
  return `${start.day} ${start.month} ${start.year} to ${end.day} ${end.month} ${end.year}`;
}
