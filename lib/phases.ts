/**
 * Calorie phases. Dates are Melbourne calendar days and both ends count.
 * Add the next phase (for example the Christmas maintenance break) as another
 * entry. The first phase whose dates contain today is the active one.
 */
export type CaloriePhase = {
  /** Present when loaded from the database. */
  id?: string;
  name: string;
  /** Inclusive start, YYYY-MM-DD. */
  start: string;
  /**
   * Inclusive end, YYYY-MM-DD.
   * An empty string means the phase has no fixed end yet.
   */
  end: string;
  kcal_target: number;
  /** Short kind shown after the name, for example "cut". */
  subtitle?: string;
  /** What starts the day after this phase ends, for example "maintenance". */
  next?: string;
  goal_weight_kg?: number | null;
  note?: string | null;
};

export const PHASES: readonly CaloriePhase[] = [
  {
    name: "Phase 1",
    start: "2026-11-09",
    end: "2026-12-22",
    kcal_target: 2000,
    subtitle: "cut",
    next: "maintenance",
  },
];

export function activePhase(
  today: string,
  phases: readonly CaloriePhase[] = PHASES,
): CaloriePhase | null {
  return (
    phases.find((phase) => {
      if (today < phase.start) return false;
      if (!phase.end) return true;
      return today <= phase.end;
    }) ?? null
  );
}

/**
 * Calendar days from today through the phase end, counting both.
 * On the last day this is 1. Outside the phase it is 0.
 * 14 Nov 2026 through 22 Dec 2026 is 39 days.
 */
export function phaseDaysLeft(today: string, phase: CaloriePhase): number {
  if (today < phase.start) return 0;
  if (!phase.end) return today >= phase.start ? 1 : 0;
  if (today > phase.end) return 0;
  const [startYear, startMonth, startDay] = today.split("-").map(Number);
  const [endYear, endMonth, endDay] = phase.end.split("-").map(Number);
  const startUtc = Date.UTC(startYear, startMonth - 1, startDay);
  const endUtc = Date.UTC(endYear, endMonth - 1, endDay);
  return Math.round((endUtc - startUtc) / 86_400_000) + 1;
}

/** Inclusive length of the phase. Phase 1 is 44 days. */
export function phaseLengthDays(phase: CaloriePhase): number {
  return phaseDaysLeft(phase.start, phase);
}

/**
 * Share of the phase already behind you.
 * Today still counts as a day to go, so 14 Nov is 5/44 and the last day is 43/44.
 */
export function phaseProgress(today: string, phase: CaloriePhase): number {
  const total = phaseLengthDays(phase);
  if (total <= 0) return 0;
  const done = total - phaseDaysLeft(today, phase);
  return Math.min(1, Math.max(0, done / total));
}

/** Short end date for the diet date strip, for example 22/12. */
export function formatPhaseEndShort(isoEnd: string): string {
  const [, month, day] = isoEnd.split("-");
  return `${Number(day)}/${Number(month)}`;
}

/** Muted phase note next to the diet date when a phase covers the selected day. */
export function formatDietPhaseStripNote(
  selectedDate: string,
  goalWeightKg: number,
  phases: readonly CaloriePhase[] = PHASES,
): string | null {
  const phase = activePhase(selectedDate, phases);
  if (!phase) return null;
  const label = phase.subtitle
    ? `${phase.subtitle.charAt(0).toUpperCase()}${phase.subtitle.slice(1)} phase`
    : phase.name;
  const goalKg = phase.goal_weight_kg ?? goalWeightKg;
  const goal = Number.isInteger(goalKg) ? String(goalKg) : String(Math.round(goalKg * 10) / 10);
  const until = phase.end ? ` · until ${formatPhaseEndShort(phase.end)}` : "";
  return `${label}${until} · goal ${goal} kg`;
}
