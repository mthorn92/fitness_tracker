import { dailyDeficitKcal, isDeficitDayReady } from "@/lib/deficit";
import { formatDatePill, formatNumber, shiftIsoDate } from "@/lib/format";

/**
 * Monthly rings.
 *
 * Fill is food eaten ÷ WHOOP burn for that day, capped at 100%.
 * Green (under) means eaten <= burned. Red (over) means eaten > burned,
 * drawn as a full ring plus an overflow mark.
 * The kcal difference reuses dailyDeficitKcal (burn − food).
 * Which days count reuses isDeficitDayReady: a past day counts even when the
 * WHOOP cycle is still open; today stays unscored until the cycle is closed
 * or the day is marked complete.
 */

export type RingJudgement = "empty" | "future" | "progress" | "under" | "over";

export type RingDayInput = {
  date: string;
  /** Food kcal logged that day. Null when nothing was logged. */
  foodKcal: number | null;
  /** WHOOP burn kcal. Null when the cycle has no burn figure. */
  whoopKcal: number | null;
  /** WHOOP cycle closed. A past day still scores when this is false. */
  cycleClosed: boolean | null;
  /** Day marked complete. Today scores when this is true even if the cycle is open. */
  complete?: boolean;
};

export type DayRing = {
  date: string;
  foodKcal: number | null;
  burnedKcal: number | null;
  /** 0–1. Capped at 1 when eaten exceeds burn. */
  fill: number;
  judgement: RingJudgement;
  /** Burn minus food when both are usable. Positive means under. */
  deltaKcal: number | null;
  /** True only for a judged over day (eaten > burned). */
  overflow: boolean;
};

export type RingSummary = {
  eaten: string;
  burned: string;
  difference: string;
  /** Today, while the WHOOP cycle is still open. */
  pending: boolean;
};

export type MonthCell = {
  date: string | null;
  ring: DayRing | null;
};

const FULL_RING = 1;

function usableFood(foodKcal: number | null): foodKcal is number {
  return foodKcal != null && Number.isFinite(foodKcal) && foodKcal >= 0;
}

function usableBurn(whoopKcal: number | null): whoopKcal is number {
  return whoopKcal != null && Number.isFinite(whoopKcal) && whoopKcal > 0;
}

export function ringForDay(day: RingDayInput, today: string): DayRing {
  const food = usableFood(day.foodKcal) ? day.foodKcal : null;
  const burned = usableBurn(day.whoopKcal) ? day.whoopKcal : null;

  const ready = isDeficitDayReady(
    { date: day.date, complete: day.complete === true, cycleClosed: day.cycleClosed },
    today,
  );

  let judgement: RingJudgement;
  if (day.date > today) judgement = "future";
  else if (!ready) judgement = "progress";
  else if (food == null || burned == null) judgement = "empty";
  else if (food > burned) judgement = "over";
  else judgement = "under";

  let fill = 0;
  let delta: number | null = null;
  if (food != null && burned != null && judgement !== "future") {
    delta = dailyDeficitKcal(burned, food);
    fill = Math.min(FULL_RING, Math.max(0, food / burned));
  }

  return {
    date: day.date,
    foodKcal: day.foodKcal,
    burnedKcal: day.whoopKcal,
    fill,
    judgement,
    deltaKcal: delta,
    overflow: judgement === "over",
  };
}

function kcalText(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${formatNumber(Math.round(value))} kcal`;
}

export function ringSummary(ring: DayRing): RingSummary {
  const eaten = kcalText(ring.foodKcal);
  const burned = kcalText(ring.burnedKcal);
  const pending = ring.judgement === "progress";

  if (ring.judgement === "future") {
    return { eaten, burned, difference: "Not yet", pending: false };
  }

  const foodMissing = ring.foodKcal == null;
  const burnMissing = ring.burnedKcal == null || ring.burnedKcal <= 0;
  if (foodMissing && burnMissing) {
    return { eaten, burned, difference: "No food or burn yet", pending };
  }
  if (foodMissing) return { eaten, burned, difference: "No food logged yet", pending };
  if (burnMissing) return { eaten, burned, difference: "No WHOOP burn yet", pending };

  const delta = ring.deltaKcal ?? dailyDeficitKcal(ring.burnedKcal as number, ring.foodKcal as number);
  const rounded = Math.round(delta);
  const difference =
    rounded === 0
      ? "Even"
      : rounded > 0
        ? `${formatNumber(rounded)} kcal under`
        : `${formatNumber(Math.abs(rounded))} kcal over`;
  return { eaten, burned, difference, pending };
}

export function ringAriaLabel(ring: DayRing): string {
  const summary = ringSummary(ring);
  const difference =
    summary.pending && ring.deltaKcal != null ? `${summary.difference}, so far` : summary.difference;
  return `${formatDatePill(ring.date)}. Eaten ${summary.eaten}. Burned ${summary.burned}. ${difference}.`;
}

export function parseYearMonth(iso: string): { year: number; month: number } {
  const [year, month] = iso.split("-").map(Number);
  return { year, month };
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** Next month is allowed only before the month that contains today. */
export function canGoToNextMonth(year: number, month: number, today: string): boolean {
  const current = parseYearMonth(today);
  if (year !== current.year) return year < current.year;
  return month < current.month;
}

export function formatMonthTitle(year: number, month: number): string {
  return new Intl.DateTimeFormat("en-AU", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** 0 = Monday … 6 = Sunday. */
function mondayIndex(year: number, month: number, day: number): number {
  const jsDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return (jsDay + 6) % 7;
}

export function dayOfMonth(iso: string): number {
  return Number(iso.slice(8, 10));
}

export function buildMonthGrid(
  year: number,
  month: number,
  days: RingDayInput[],
  today: string,
): MonthCell[] {
  const byDate = new Map(days.map((day) => [day.date, day]));
  const count = daysInMonth(year, month);
  const cells: MonthCell[] = [];
  const leading = mondayIndex(year, month, 1);
  for (let i = 0; i < leading; i++) cells.push({ date: null, ring: null });

  for (let day = 1; day <= count; day++) {
    const date = isoDate(year, month, day);
    const input = byDate.get(date) ?? {
      date,
      foodKcal: null,
      whoopKcal: null,
      cycleClosed: null,
    };
    cells.push({ date, ring: ringForDay(input, today) });
  }

  while (cells.length % 7 !== 0) cells.push({ date: null, ring: null });
  return cells;
}

export function monthCounts(
  days: RingDayInput[],
  today: string,
  year: number,
  month: number,
): { green: number; red: number } {
  const prefix = `${year}-${String(month).padStart(2, "0")}-`;
  const seen = new Set<string>();
  let green = 0;
  let red = 0;
  for (const day of days) {
    if (!day.date.startsWith(prefix) || seen.has(day.date)) continue;
    seen.add(day.date);
    const ring = ringForDay(day, today);
    if (ring.judgement === "under") green += 1;
    else if (ring.judgement === "over") red += 1;
  }
  return { green, red };
}

/**
 * Green days in a row, ending at the latest scored day on or before today.
 * Today does not break the streak when it is still open or not yet scored.
 * A red day, or a past day with nothing to score, stops it.
 */
export function greenStreak(days: RingDayInput[], today: string): number {
  const byDate = new Map(days.map((day) => [day.date, day]));
  if (byDate.size === 0) return 0;
  const earliest = [...byDate.keys()].sort()[0];
  let streak = 0;
  let cursor = today;

  while (cursor >= earliest) {
    const input = byDate.get(cursor) ?? {
      date: cursor,
      foodKcal: null,
      whoopKcal: null,
      cycleClosed: null,
    };
    const ring = ringForDay(input, today);
    const todayUnscored =
      cursor === today && (ring.judgement === "progress" || ring.judgement === "empty");
    if (todayUnscored) {
      cursor = shiftIsoDate(cursor, -1);
      continue;
    }
    if (ring.judgement === "under") {
      streak += 1;
      cursor = shiftIsoDate(cursor, -1);
      continue;
    }
    break;
  }

  return streak;
}

export function monthTallyText(green: number, red: number, streak: number | null): string {
  const counts =
    green === 0 && red === 0
      ? "No green or red days yet"
      : `${green} green ${green === 1 ? "day" : "days"} · ${red} red`;
  if (streak != null && streak > 0) return `${counts} · ${streak}-day streak`;
  return counts;
}
