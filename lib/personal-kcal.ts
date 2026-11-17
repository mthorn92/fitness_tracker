import { withSevenDayAverage } from "@/lib/charts";
import { buildDeficitSeries, type DeficitDayInput } from "@/lib/deficit";
import { isDeficitDayReady } from "@/lib/deficit";
import { activePhase, PHASES, type CaloriePhase } from "@/lib/phases";

export const PERSONAL_KCAL_REFERENCE = 7700;
export const PERSONAL_SETTLE_DAYS = 14;
/** Rolling line starts on the third closed phase day. */
export const PERSONAL_ROLLING_FROM_DAY = 3;

export type PersonalKcalInputDay = {
  date: string;
  weight_kg: number | null;
  whoop_burn_kcal: number | null;
  kcal: number | null;
  cycle_closed?: boolean | null;
  complete?: boolean;
};

export type PersonalKcalPoint = {
  date: string;
  /** Day-of-month for chart labels. */
  label: string;
  daily: number | null;
  rolling: number | null;
};

export type PersonalKcalModel = {
  heroKcalPerKg: number | null;
  closedDays: number;
  neededDays: number;
  settleLabel: string | null;
  points: PersonalKcalPoint[];
  cumulativeDeficitKcal: number;
};

function dayMonthLabel(iso: string): string {
  const [, , day] = iso.split("-");
  return String(Number(day));
}

function isClosedInPhase(
  day: Pick<PersonalKcalInputDay, "date" | "complete" | "cycle_closed">,
  today: string,
  phase: CaloriePhase,
): boolean {
  if (day.date < phase.start || day.date > phase.end) return false;
  if (day.date > today) return false;
  return isDeficitDayReady(
    { date: day.date, complete: day.complete, cycleClosed: day.cycle_closed },
    today,
  );
}

function rolling7ByDate(
  days: readonly PersonalKcalInputDay[],
): Map<string, number | null> {
  const points = days
    .filter((day) => day.weight_kg != null && Number.isFinite(day.weight_kg))
    .map((day) => ({ date: day.date, value: day.weight_kg as number }));
  const rolling = withSevenDayAverage(points);
  const map = new Map<string, number | null>();
  for (const day of days) map.set(day.date, null);
  for (const point of rolling) map.set(point.date, point.avg7d);
  return map;
}

export function ratioKcalPerKg(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return null;
  const value = numerator / denominator;
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function buildPersonalKcalModel(
  days: readonly PersonalKcalInputDay[],
  today: string,
  phases: readonly CaloriePhase[] = PHASES,
): PersonalKcalModel | null {
  const phase = activePhase(today, phases);
  if (!phase) {
    return {
      heroKcalPerKg: null,
      closedDays: 0,
      neededDays: PERSONAL_SETTLE_DAYS,
      settleLabel: null,
      points: [],
      cumulativeDeficitKcal: 0,
    };
  }

  const inPhase = days.filter((day) => day.date >= phase.start && day.date <= phase.end);
  const rolling = rolling7ByDate(inPhase);
  const startAvg7 = rolling.get(phase.start) ?? null;

  const closedDays = inPhase.filter((day) => isClosedInPhase(day, today, phase));
  const closedCount = closedDays.length;

  const firstWeighIn =
    closedDays.find((day) => day.weight_kg != null && Number.isFinite(day.weight_kg))?.weight_kg ?? null;

  const deficitInputs: DeficitDayInput[] = inPhase.map((day) => ({
    date: day.date,
    whoopKcal: day.whoop_burn_kcal,
    foodKcal: day.kcal ?? null,
    weightKg: day.weight_kg,
    complete: day.complete,
    cycleClosed: day.cycle_closed,
  }));
  const deficit = buildDeficitSeries(deficitInputs, { today });
  const cumulativeByDate = new Map(deficit.points.map((point) => [point.date, point.cumulativeDeficitKcal]));

  const lastClosed = closedDays[closedDays.length - 1] ?? null;
  const currentAvg7 = lastClosed ? (rolling.get(lastClosed.date) ?? null) : null;
  const weightLost =
    startAvg7 != null && currentAvg7 != null ? startAvg7 - currentAvg7 : null;
  const cumulativeAtEnd = lastClosed ? (cumulativeByDate.get(lastClosed.date) ?? 0) : 0;
  const heroKcalPerKg =
    weightLost != null ? ratioKcalPerKg(cumulativeAtEnd, weightLost) : null;

  const points: PersonalKcalPoint[] = [];
  closedDays.forEach((day, index) => {
    const cumulative = cumulativeByDate.get(day.date) ?? null;
    const dayRolling = rolling.get(day.date) ?? null;
    const dailyDen =
      firstWeighIn != null && day.weight_kg != null ? firstWeighIn - day.weight_kg : null;
    const daily =
      cumulative != null && dailyDen != null ? ratioKcalPerKg(cumulative, dailyDen) : null;
  let rollingValue: number | null = null;
    if (
      index + 1 >= PERSONAL_ROLLING_FROM_DAY &&
      cumulative != null &&
      startAvg7 != null &&
      dayRolling != null
    ) {
      const rollDen = startAvg7 - dayRolling;
      rollingValue = ratioKcalPerKg(cumulative, rollDen);
    }
    points.push({
      date: day.date,
      label: dayMonthLabel(day.date),
      daily,
      rolling: rollingValue,
    });
  });

  const settleLabel =
    closedCount > 0 && closedCount < PERSONAL_SETTLE_DAYS
      ? `Settling · ${closedCount}/${PERSONAL_SETTLE_DAYS}`
      : null;

  return {
    heroKcalPerKg,
    closedDays: closedCount,
    neededDays: PERSONAL_SETTLE_DAYS,
    settleLabel,
    points,
    cumulativeDeficitKcal: cumulativeAtEnd,
  };
}