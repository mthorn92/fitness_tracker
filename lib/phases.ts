/**
 * Calorie phases. Dates are Melbourne calendar days and both ends count.
 * Add the next phase (for example the Christmas maintenance break) as another
 * entry. The first phase whose dates contain today is the active one.
 */
export type CaloriePhase = {
  name: string;
  /** Inclusive start, YYYY-MM-DD. */
  start: string;
  /** Inclusive end, YYYY-MM-DD. */
  end: string;
  kcal_target: number;
};

export const PHASES: readonly CaloriePhase[] = [
  {
    name: "Phase 1",
    start: "2026-11-09",
    end: "2026-12-22",
    kcal_target: 2000,
  },
];

export function activePhase(
  today: string,
  phases: readonly CaloriePhase[] = PHASES,
): CaloriePhase | null {
  return phases.find((phase) => phase.start <= today && today <= phase.end) ?? null;
}

/**
 * Calendar days from today through the phase end, counting both.
 * On the last day this is 1. Outside the phase it is 0.
 * 14 Nov 2026 through 22 Dec 2026 is 39 days.
 */
export function phaseDaysLeft(today: string, phase: CaloriePhase): number {
  if (today < phase.start || today > phase.end) return 0;
  const [startYear, startMonth, startDay] = today.split("-").map(Number);
  const [endYear, endMonth, endDay] = phase.end.split("-").map(Number);
  const startUtc = Date.UTC(startYear, startMonth - 1, startDay);
  const endUtc = Date.UTC(endYear, endMonth - 1, endDay);
  return Math.round((endUtc - startUtc) / 86_400_000) + 1;
}
