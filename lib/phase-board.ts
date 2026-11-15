import type { CalorieAverage } from "@/lib/calorie-average";
import { phaseCalorieAverage } from "@/lib/calorie-average";
import { dailyDeficitKcal, isDeficitDayReady, KCAL_PER_KG } from "@/lib/deficit";
import { shiftIsoDate } from "@/lib/format";
import { activePhase, phaseDaysLeft, phaseLengthDays, PHASES, type CaloriePhase } from "@/lib/phases";

export type PhaseBoardDay = {
  date: string;
  kcal: number | null;
  whoopKcal: number | null;
  complete?: boolean;
  cycleClosed?: boolean | null;
};

export type PhaseBoard = {
  phase: CaloriePhase;
  daysLeft: number;
  loggedDays: number;
  logSlots: number;
  average: CalorieAverage | null;
  /** Closed-cycle burn minus food inside the phase, through the as-of day. */
  deficitKcal: number;
  /** Expected weight change. Negative is loss. */
  expectedKg: number;
};

/**
 * Phase summary as of a selected calendar day.
 * Planned and future food must already be absent from `kcal`.
 * An open today is left out of the average, the logged count, and the deficit.
 */
export function buildPhaseBoard(
  days: readonly PhaseBoardDay[],
  selected: string,
  today: string,
  phases: readonly CaloriePhase[] = PHASES,
): PhaseBoard | null {
  const phase = activePhase(selected, phases);
  if (!phase) return null;

  const todayClosed =
    selected >= today &&
    isDeficitDayReady(
      {
        date: today,
        complete: days.find((day) => day.date === today)?.complete,
        cycleClosed: days.find((day) => day.date === today)?.cycleClosed,
      },
      today,
    );
  const through = selected < today ? selected : todayClosed ? today : shiftIsoDate(today, -1);
  const todayInPhase = phase.start <= today && today <= phase.end;
  const logSlots = phaseLengthDays(phase) - (todayInPhase && !todayClosed ? 1 : 0);

  const byDate = new Map(days.map((day) => [day.date, day]));
  let loggedDays = 0;
  let deficitKcal = 0;
  const end = through < phase.end ? through : phase.end;
  if (end >= phase.start) {
    for (let date = phase.start; date <= end; date = shiftIsoDate(date, 1)) {
      const day = byDate.get(date);
      if (!day) continue;
      if (
        !isDeficitDayReady(
          { date, complete: day.complete, cycleClosed: day.cycleClosed },
          today,
        )
      ) {
        continue;
      }
      if (typeof day.kcal === "number" && Number.isFinite(day.kcal)) loggedDays += 1;
      if (day.kcal == null || day.whoopKcal == null) continue;
      deficitKcal += dailyDeficitKcal(day.whoopKcal, day.kcal);
    }
  }

  const averageAnchor = selected < today ? shiftIsoDate(selected, 1) : today;
  return {
    phase,
    daysLeft: phaseDaysLeft(selected, phase),
    loggedDays,
    logSlots,
    average: phaseCalorieAverage(days, averageAnchor, phase),
    deficitKcal,
    expectedKg: -deficitKcal / KCAL_PER_KG,
  };
}
