import { shiftIsoDate } from "@/lib/format";

export type DietWindowDay = {
  date: string;
  foodKcal: number | null;
  whoopKcal: number | null;
};

/**
 * Chart/series start date for the diet dashboard.
 *
 * Prefer the first day with both food and WHOOP burn (real logging), else the
 * first food day, else yesterday relative to `today`. Never start on WHOOP-only
 * prelude days before food logging began.
 */
export function dietChartStartDate(
  days: DietWindowDay[],
  today: string,
): string {
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const firstBoth = sorted.find((day) => day.foodKcal != null && day.whoopKcal != null);
  if (firstBoth) return firstBoth.date;
  const firstFood = sorted.find((day) => day.foodKcal != null);
  if (firstFood) return firstFood.date;
  return shiftIsoDate(today, -1);
}

/** Inclusive ISO dates from start through end. */
export function enumerateIsoDates(start: string, end: string): string[] {
  if (end < start) return [];
  const out: string[] = [];
  let cursor = start;
  while (cursor <= end) {
    out.push(cursor);
    cursor = shiftIsoDate(cursor, 1);
  }
  return out;
}
