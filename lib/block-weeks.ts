import { parseIsoDate, shiftIsoDate } from "@/lib/format";
import type { TrainingPlan } from "@/lib/types";

/** Melbourne calendar days are YYYY-MM-DD keys interpreted as UTC calendar dates. */

function dayOfWeek(isoDate: string): number {
  return parseIsoDate(isoDate).getUTCDay();
}

function daysBetween(start: string, date: string): number {
  const ms = parseIsoDate(date).getTime() - parseIsoDate(start).getTime();
  return Math.round(ms / 86_400_000);
}

function blockEndDate(plan: TrainingPlan): string {
  if (plan.end_date) return plan.end_date;
  return shiftIsoDate(plan.start_date, plan.weeks.length * 7 - 1);
}

/** First Monday that begins standard Mon–Sun weeks after the partial first week. */
function secondWeekMonday(blockStart: string): string {
  const startDow = dayOfWeek(blockStart);
  if (startDow === 1) return shiftIsoDate(blockStart, 7);
  const minGap = 8;
  let cursor = shiftIsoDate(blockStart, 1);
  while (dayOfWeek(cursor) !== 1) cursor = shiftIsoDate(cursor, 1);
  while (daysBetween(blockStart, cursor) < minGap) cursor = shiftIsoDate(cursor, 1);
  while (dayOfWeek(cursor) !== 1) cursor = shiftIsoDate(cursor, 1);
  return cursor;
}

export type BlockWeekRange = { week: number; start: string; end: string };

/** Inclusive Melbourne calendar ranges for each plan week. */
export function blockWeekRanges(plan: TrainingPlan): BlockWeekRange[] {
  const blockStart = plan.start_date;
  const blockEnd = blockEndDate(plan);
  const totalWeeks = plan.weeks.length;
  if (totalWeeks === 0) return [];

  const week2Monday = secondWeekMonday(blockStart);
  const ranges: BlockWeekRange[] = [
    { week: 1, start: blockStart, end: shiftIsoDate(week2Monday, -1) },
  ];

  let nextMonday = week2Monday;
  for (let week = 2; week <= totalWeeks; week += 1) {
    if (week === totalWeeks) {
      ranges.push({ week, start: nextMonday, end: blockEnd });
      break;
    }
    const weekEnd = shiftIsoDate(nextMonday, 6);
    ranges.push({ week, start: nextMonday, end: weekEnd });
    nextMonday = shiftIsoDate(weekEnd, 1);
  }

  return ranges;
}

/** 1-based week in the block, clamped to 1..week count. Null when `date` is outside the block. */
export function blockWeekForDate(date: string, plan: TrainingPlan): number | null {
  if (date < plan.start_date || date > blockEndDate(plan)) return null;
  for (const range of blockWeekRanges(plan)) {
    if (date >= range.start && date <= range.end) return range.week;
  }
  return plan.weeks[plan.weeks.length - 1]?.week ?? null;
}

export function blockWeekRange(week: number, plan: TrainingPlan): { start: string; end: string } | null {
  const range = blockWeekRanges(plan).find((entry) => entry.week === week);
  if (!range) return null;
  return { start: range.start, end: range.end };
}