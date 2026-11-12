import { formatShortDate, shiftIsoDate } from "@/lib/format";
import { loadTrainingPlan, planWeekRange, prescribeDay } from "@/lib/plan";
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
  position: 1 | 2 | 4 | 5;
  planDay: PlanWeekday;
  name: string;
  dateLabel: string;
  isToday: boolean;
  status: string;
  weekLabel: string;
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
  const schedule = strengthSchedule(date);
  const today = await getTrainingTile(date);
  const todayMode = schedule.anchor.in_block && schedule.anchor.kind === "lift" ? "lift" : "full";
  const sessions =
    schedule.mode === "upcoming" || !schedule.range
      ? []
      : await listSessions({ from: schedule.range.start, to: schedule.range.end });
  const positions = [1, 2, 4, 5] as const;
  const days = schedule.days.map((day, index) => {
    const position = positions[index];
    if (position == null) throw new Error("Expected four strength days.");
    const session = schedule.mode === "upcoming" ? null : sessionForStrengthDay(sessions, day);
    const completed = session != null;
    return {
      position,
      planDay: day.weekday,
      name: day.prescribed.label ?? "Strength",
      dateLabel: formatShortDate(day.date),
      isToday: day.isToday,
      status: statusLabel(schedule.mode, completed),
      weekLabel: weekLabel(schedule.mode, day.prescribed.week, day.prescribed.week_type),
      deloadNote: day.prescribed.deload_note,
      completed,
      groups: trainingGroups(day.prescribed, session),
      rpe: session?.rpe ?? null,
      feedback: session?.feedback ?? null,
    };
  });
  return { today, todayMode, days };
}

function statusLabel(mode: WeekMode, completed: boolean): string {
  if (mode === "upcoming") return "Preview";
  if (completed) return mode === "current" ? "Done this week" : "Done";
  return mode === "current" ? "Not done this week" : "Not done";
}

function weekLabel(mode: WeekMode, week: number | null, weekType: string | null): string {
  const number = week ?? 1;
  if (mode === "upcoming") return `Week ${number}`;
  if (mode === "ended") return `Week ${number} · ended`;
  return `Week ${number} · ${weekType ?? "build"}`;
}
