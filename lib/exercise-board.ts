import { formatShortDate, parseIsoDate, shiftIsoDate } from "@/lib/format";
import { loadTrainingPlan, planWeekRange, prescribeDay } from "@/lib/plan";
import { formatStrengthDayCopy } from "@/lib/strength-copy";
import { listSessions } from "@/lib/store";
import { getTrainingTile, trainingGroups, type TrainingGroup, type TrainingTile } from "@/lib/training-view";
import type { PlanWeekday, TrainingPlan, TrainingSession } from "@/lib/types";

/** Monday, Wednesday, Thursday, Saturday — the four strength days, in week order. */
export const STRENGTH_DAYS: PlanWeekday[] = ["mon", "wed", "thu", "sat"];

const WEEKDAY_OFFSET: Record<PlanWeekday, number> = {
  mon: 0,
  tue: 1,
  wed: 2,
  thu: 3,
  fri: 4,
  sat: 5,
  sun: 6,
};

export type StrengthTileModel = {
  /** Reading order on the Exercise tab: the four strength days, then the Strava tiles. */
  position: 1 | 2 | 3 | 4;
  planDay: PlanWeekday;
  name: string;
  dateLabel: string;
  isToday: boolean;
  status: string;
  weekLabel: string;
  /** Plain text for the Copy button. Same week label as the card. */
  copyText: string;
  deloadNote: string | null;
  completed: boolean;
  groups: TrainingGroup[];
  rpe: number | null;
  feedback: string | null;
};

export type ExerciseBoard = {
  today: TrainingTile;
  /** Full shows runs, rest, and the before/after note. Lift points at the highlighted tile. */
  todayMode: "full" | "lift";
  days: StrengthTileModel[];
  /** Plain text for all four strength days, blank line between days. */
  weekCopyText: string;
};

type WeekMode = "current" | "upcoming" | "ended";

export function strengthSchedule(date: string, plan: TrainingPlan = loadTrainingPlan()) {
  const anchor = prescribeDay(date, plan);
  let weekNumber: number;
  let mode: WeekMode;
  if (anchor.in_block && anchor.week != null) {
    weekNumber = anchor.week;
    mode = "current";
  } else if (date < plan.start_date) {
    weekNumber = 1;
    mode = "upcoming";
  } else {
    weekNumber = plan.weeks.length;
    mode = "ended";
  }
  const range = planWeekRange(weekNumber, plan);
  if (!range) {
    return { mode, weekNumber, range: null, days: [], anchor };
  }
  const days = STRENGTH_DAYS.map((weekday) => {
    const dayDate = shiftIsoDate(range.start, WEEKDAY_OFFSET[weekday]);
    const prescribed = prescribeDay(dayDate, plan);
    return {
      weekday,
      date: dayDate,
      prescribed,
      isToday: mode === "current" && dayDate === date && prescribed.kind === "lift",
    };
  });
  return { mode, weekNumber, range, days, anchor };
}

export function sessionForStrengthDay(
  sessions: TrainingSession[],
  day: { date: string; weekday: PlanWeekday },
): TrainingSession | null {
  const completed = sessions.filter((session) => session.completed);
  const byPlan = completed.filter((session) => session.plan_day === day.weekday);
  if (byPlan.length > 0) return byPlan[byPlan.length - 1] ?? null;
  const byDate = completed.filter((session) => session.date === day.date && session.plan_day == null);
  return byDate[byDate.length - 1] ?? null;
}

export async function getExerciseBoard(date: string): Promise<ExerciseBoard> {
  const plan = loadTrainingPlan();
  const schedule = strengthSchedule(date, plan);
  const sessions =
    schedule.mode === "upcoming" || !schedule.range
      ? undefined
      : await listSessions({ from: schedule.range.start, to: schedule.range.end });
  const today = await getTrainingTile(date, sessions);
  const todayMode = schedule.anchor.in_block && schedule.anchor.kind === "lift" ? "lift" : "full";
  const positions = [1, 2, 3, 4] as const;
  const days = schedule.days.map((day, index) => {
    const position = positions[index];
    if (position == null) throw new Error("Expected four strength days.");
    const session = schedule.mode === "upcoming" || !sessions ? null : sessionForStrengthDay(sessions, day);
    const completed = session != null;
    const label = strengthWeekLabel({
      mode: schedule.mode,
      week: schedule.weekNumber,
      weeksInBlock: plan.weeks.length,
      startDate: plan.start_date,
      isToday: day.isToday,
    });
    const name = day.prescribed.label ?? "Strength";
    return {
      position,
      planDay: day.weekday,
      name,
      dateLabel: formatShortDate(day.date),
      isToday: day.isToday,
      status: statusLabel(schedule.mode, completed),
      weekLabel: label,
      copyText: formatStrengthDayCopy({
        name,
        weekLabel: label,
        items: day.prescribed.items,
        deloadNote: day.prescribed.deload_note,
      }),
      deloadNote: day.prescribed.deload_note,
      completed,
      groups: trainingGroups(day.prescribed, session),
      rpe: session?.rpe ?? null,
      feedback: session?.feedback ?? null,
    };
  });
  return {
    today,
    todayMode,
    days,
    weekCopyText: days.map((day) => day.copyText).join("\n\n"),
  };
}

/** Small line under the day name. The copy header uses this same string. */
export function strengthWeekLabel(input: {
  mode: WeekMode;
  week: number;
  weeksInBlock: number;
  startDate: string;
  isToday: boolean;
}): string {
  const weekPart = `Week ${input.week} of ${input.weeksInBlock}`;
  if (input.mode === "upcoming") return `Starts ${formatPlanStart(input.startDate)} · ${weekPart}`;
  if (input.isToday) return `Today · ${weekPart}`;
  return weekPart;
}

function formatPlanStart(iso: string): string {
  const date = parseIsoDate(iso);
  const weekday = new Intl.DateTimeFormat("en-AU", { weekday: "short", timeZone: "UTC" }).format(date);
  const day = new Intl.DateTimeFormat("en-AU", { day: "numeric", timeZone: "UTC" }).format(date);
  const month = new Intl.DateTimeFormat("en-AU", { month: "short", timeZone: "UTC" }).format(date);
  return `${weekday} ${day} ${month}`;
}

function statusLabel(mode: WeekMode, completed: boolean): string {
  if (mode === "upcoming") return "Preview";
  if (completed) return mode === "current" ? "Done this week" : "Done";
  return mode === "current" ? "Not done this week" : "Not done";
}

