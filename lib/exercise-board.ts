import { formatDatePill, parseIsoDate, shiftIsoDate } from "@/lib/format";
import {
  emptyWork,
  formatActual,
  formatTarget,
  bestEpley,
  setWork,
  type DoneStatus,
} from "@/lib/exercise-progress";
import { loadActiveTrainingPlan } from "@/lib/plan-store";
import {
  loadTrainingPlan,
  planEndDate,
  planWeekRange,
  prescribeDay,
  prescribeSlot,
  scheduledTrainingDays,
  weekMetaForDate,
} from "@/lib/plan";
import { listSessions, listWeights } from "@/lib/store";
import type { StrengthCopyDay } from "@/lib/strength-copy";
import type {
  DaySlot,
  MuscleGroup,
  PlanWeekday,
  PrescribedExercise,
  TrainingPlan,
  TrainingSession,
} from "@/lib/types";

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

const WEEKDAY_SLOT: Array<{ id: DaySlot; weekday: PlanWeekday }> = [
  { id: "a", weekday: "mon" },
  { id: "b", weekday: "wed" },
  { id: "c", weekday: "thu" },
  { id: "d", weekday: "sat" },
];

const E1RM_KEYS = {
  bench: "bench_press",
  ohp: "overhead_press",
  boxSquat: "box_squat",
  deadlift: "deadlift",
} as const;

export type ExerciseRowModel = {
  key: string;
  name: string;
  target: string;
  actual: string | null;
  status: DoneStatus;
  superset: string | null;
};

export type DayTileModel = {
  position: 1 | 2 | 3 | 4;
  slot: DaySlot;
  name: string;
  statusLabel: string;
  weekLabel: string;
  rows: ExerciseRowModel[];
};

export type WeekBoard = {
  week: number;
  weekLabel: string;
  subtitle: string;
  sessions: number;
  days: DayTileModel[];
  copyDays: StrengthCopyDay[];
  pullups: { assisted: number; strict: number; band: string | null };
};

export type WorkWeek = {
  week: number;
  groups: Record<MuscleGroup, number>;
  total: number;
};

export type ExerciseBoard = {
  planId: string;
  planName: string;
  todayLabel: string;
  todayNote: string | null;
  currentWeek: number;
  weekCount: number;
  weeks: WeekBoard[];
  work: WorkWeek[];
  e1rm: { bench: number | null; ohp: number | null; boxSquat: number | null; deadlift: number | null };
  phase: {
    name: string;
    datesLabel: string;
    daysLeft: number;
    sessionsPerWeek: number;
    blockSessions: number;
    blockTarget: number;
    strictPullups: number;
    strictByWeek: number[];
    weightKg: number | null;
    weightTrend: "down" | "up" | "flat" | null;
    weightSeries: number[];
  };
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
  const plan = await loadActiveTrainingPlan();
  const end = planEndDate(plan);
  const [sessions, weights] = await Promise.all([
    listSessions({ from: plan.start_date, to: end }),
    listWeights(),
  ]);
  return buildExerciseBoard({ date, plan, sessions, weights });
}

export function buildExerciseBoard(input: {
  date: string;
  plan: TrainingPlan;
  sessions: TrainingSession[];
  weights: Array<{ date: string; kg: number }>;
}): ExerciseBoard {
  const { date, plan, sessions, weights } = input;
  const end = planEndDate(plan);
  const muscles = muscleMap(plan);
  const flexible = Boolean(plan.slots && plan.slots.length > 0);
  const perWeek = plan.slots && plan.slots.length > 0 ? plan.slots.length : liftDayCount(plan);
  const weekCount = plan.weeks.length;
  const currentWeek = currentPlanWeek(date, plan);

  const work: WorkWeek[] = [];
  const strictByWeek: number[] = [];
  const weeks: WeekBoard[] = [];
  let blockSessions = 0;

  for (const meta of plan.weeks) {
    const range = planWeekRange(meta.week, plan);
    const inWeek = range
      ? sessions.filter((session) => session.date >= range.start && session.date <= range.end)
      : [];
    const slotDays = slotsForWeek(plan, meta.week, flexible);
    const assigned = assignSessions(slotDays, inWeek, flexible ? undefined : weekdayMap());
    const rowsBySlot = new Map<DaySlot, ExerciseRowModel[]>();
    for (const slot of slotDays) {
      const session = assigned.get(slot.id) ?? null;
      rowsBySlot.set(slot.id, rowsFor(slot.items, session));
    }
    const doneSlots = slotDays.filter((slot) => assigned.has(slot.id)).map((slot) => slot.id);
    blockSessions += doneSlots.length;
    const groups = emptyWork();
    let strict = 0;
    let assisted = 0;
    let band: string | null = null;
    for (const session of inWeek) {
      if (!session.completed) continue;
      for (const set of session.sets) {
        const muscle = muscles.get(set.exercise_key);
        if (muscle) groups[muscle] += setWork(set);
        if (!set.done) continue;
        if (set.exercise_key === "strict_pullup") strict += set.reps ?? 0;
        if (set.exercise_key === "banded_pullup") {
          assisted += set.reps ?? 0;
          if (set.band) band = set.band;
        }
      }
    }
    if (!band) {
      const prescribed = slotDays.flatMap((slot) => slot.items).find((item) => item.key === "banded_pullup");
      band = prescribed?.band ?? null;
    }
    const total = MUSCLE_ORDER.reduce((sum, muscle) => sum + groups[muscle], 0);
    work.push({ week: meta.week, groups, total });
    strictByWeek.push(strict);
    const positions = [1, 2, 3, 4] as const;
    weeks.push({
      week: meta.week,
      weekLabel: `Week ${meta.week} of ${weekCount}`,
      subtitle: weekSubtitle(doneSlots, date, plan),
      sessions: doneSlots.length,
      copyDays: slotDays.map((slot) => ({
        name: slot.label,
        weekLabel: `Week ${meta.week} of ${weekCount}`,
        items: slot.items,
        deloadNote: meta.type === "deload" && slot.items.length > 0 ? plan.deload_rule.rir_note : null,
      })),
      pullups: { assisted, strict, band: formatBandShort(band) },
      days: slotDays.map((slot, index) => {
        const session = assigned.get(slot.id) ?? null;
        const position = positions[index] ?? 1;
        return {
          position,
          slot: slot.id,
          name: slot.label,
          statusLabel: dayStatus(slot, session, flexible),
          weekLabel: `Week ${meta.week} of ${weekCount}`,
          rows: rowsBySlot.get(slot.id) ?? [],
        };
      }),
    });
  }

  const e1rmSets = new Map<string, TrainingSession["sets"]>();
  for (const session of sessions) {
    if (!session.completed) continue;
    for (const set of session.sets) {
      const list = e1rmSets.get(set.exercise_key) ?? [];
      list.push(set);
      e1rmSets.set(set.exercise_key, list);
    }
  }

  const weightSeries = weightPoints(weights, plan.start_date, date);
  const latest = weightSeries.length > 0 ? weightSeries[weightSeries.length - 1] : null;
  const previous = weightSeries.length > 1 ? weightSeries[weightSeries.length - 2] : null;

  return {
    planId: plan.id,
    planName: plan.name,
    todayLabel: formatDatePill(date),
    todayNote:
      plan.walk_only && date >= plan.walk_only.start_date && date <= plan.walk_only.end_date
        ? plan.walk_only.note
        : null,
    currentWeek,
    weekCount,
    weeks,
    work,
    e1rm: {
      bench: round1(bestEpley(e1rmSets.get(E1RM_KEYS.bench) ?? [])),
      ohp: round1(bestEpley(e1rmSets.get(E1RM_KEYS.ohp) ?? [])),
      boxSquat: round1(bestEpley(e1rmSets.get(E1RM_KEYS.boxSquat) ?? [])),
      deadlift: round1(bestEpley(e1rmSets.get(E1RM_KEYS.deadlift) ?? [])),
    },
    phase: {
      name: plan.name,
      datesLabel: `${formatDayMonth(plan.start_date)} to ${formatDayMonth(end)}`,
      daysLeft: Math.max(0, daysBetween(date, end)),
      sessionsPerWeek: perWeek,
      blockSessions,
      blockTarget: perWeek * weekCount,
      strictPullups: strictByWeek.reduce((sum, value) => sum + value, 0),
      strictByWeek,
      weightKg: latest,
      weightTrend: latest == null || previous == null ? null : latest < previous ? "down" : latest > previous ? "up" : "flat",
      weightSeries,
    },
  };
}

const MUSCLE_ORDER: MuscleGroup[] = ["legs", "back", "chest", "shoulders", "arms"];

type SlotDay = {
  id: DaySlot;
  label: string;
  items: PrescribedExercise[];
  date: string | null;
};

function slotsForWeek(plan: TrainingPlan, week: number, flexible: boolean): SlotDay[] {
  if (flexible && plan.slots) {
    return plan.slots.map((slot) => ({
      id: slot.id,
      label: slot.label,
      items: prescribeSlot(slot, week, plan),
      date: null,
    }));
  }
  const range = planWeekRange(week, plan);
  return WEEKDAY_SLOT.map((slot) => {
    const date = range ? shiftIsoDate(range.start, WEEKDAY_OFFSET[slot.weekday]) : null;
    const prescribed = date ? prescribeDay(date, plan) : null;
    return {
      id: slot.id,
      label: prescribed?.label ?? `Day ${slot.id.toUpperCase()}`,
      items: prescribed?.items ?? [],
      date,
    };
  });
}

function weekdayMap(): Map<DaySlot, PlanWeekday> {
  return new Map(WEEKDAY_SLOT.map((slot) => [slot.id, slot.weekday]));
}

export function assignSessions(
  slots: Array<{ id: DaySlot; items: Array<{ key: string }> }>,
  sessions: TrainingSession[],
  weekdayBySlot?: Map<DaySlot, PlanWeekday>,
): Map<DaySlot, TrainingSession> {
  const result = new Map<DaySlot, TrainingSession>();
  const completed = sessions
    .filter((session) => session.completed)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const slotIds = new Set(slots.map((slot) => slot.id));

  for (const session of completed) {
    if (!session.day_slot || !slotIds.has(session.day_slot)) continue;
    result.set(session.day_slot, session);
  }

  if (weekdayBySlot) {
    for (const session of completed) {
      if (session.day_slot || !session.plan_day) continue;
      const slot = [...weekdayBySlot.entries()].find(([, weekday]) => weekday === session.plan_day)?.[0];
      if (!slot || result.has(slot)) continue;
      result.set(slot, session);
    }
  }

  const keyOwners = new Map<string, Set<DaySlot>>();
  for (const slot of slots) {
    for (const item of slot.items) {
      const owners = keyOwners.get(item.key) ?? new Set<DaySlot>();
      owners.add(slot.id);
      keyOwners.set(item.key, owners);
    }
  }

  const candidates: Array<{ session: TrainingSession; slot: DaySlot; score: number; uniqueScore: number }> = [];
  for (const session of completed) {
    if (session.day_slot && slotIds.has(session.day_slot)) continue;
    if (weekdayBySlot && session.plan_day && [...result.values()].some((saved) => saved.id === session.id)) continue;
    const keys = new Set(session.sets.map((set) => set.exercise_key));
    for (const slot of slots) {
      if (result.has(slot.id)) continue;
      let score = 0;
      let uniqueScore = 0;
      for (const key of keys) {
        const owners = keyOwners.get(key);
        if (!owners?.has(slot.id)) continue;
        score += 1;
        if (owners.size === 1) uniqueScore += 1;
      }
      if (score > 0) candidates.push({ session, slot: slot.id, score, uniqueScore });
    }
  }
  candidates.sort(
    (a, b) => b.uniqueScore - a.uniqueScore || b.score - a.score || a.session.id.localeCompare(b.session.id),
  );
  const used = new Set<string>([...result.values()].map((session) => session.id));
  for (const candidate of candidates) {
    if (used.has(candidate.session.id) || result.has(candidate.slot)) continue;
    result.set(candidate.slot, candidate.session);
    used.add(candidate.session.id);
  }
  return result;
}

function rowsFor(items: PrescribedExercise[], session: TrainingSession | null): ExerciseRowModel[] {
  const logged = new Map<string, TrainingSession["sets"]>();
  for (const set of session?.sets ?? []) {
    const list = logged.get(set.exercise_key) ?? [];
    list.push(set);
    logged.set(set.exercise_key, list);
  }
  return items.map((item) => {
    const actual = formatActual(logged.get(item.key) ?? [], item);
    return {
      key: item.key,
      name: item.name,
      target: formatTarget(item),
      actual: actual.text,
      status: actual.status,
      superset: supersetLetter(item.group),
    };
  });
}

function supersetLetter(group: string | null): string | null {
  if (!group) return null;
  const match = /^([A-Za-z]+)\d*$/.exec(group);
  return match ? match[1].toUpperCase() : group;
}

function dayStatus(slot: SlotDay, session: TrainingSession | null, flexible: boolean): string {
  if (session) return formatDatePill(session.date);
  if (!flexible && slot.date) return formatDatePill(slot.date);
  return "Not started";
}

function weekSubtitle(done: DaySlot[], _date: string, plan: TrainingPlan): string {
  if (done.length === 0) return plan.daily_walk;
  const letters = done.map((slot) => slot.toUpperCase());
  const who =
    letters.length === 1
      ? `Day ${letters[0]} done`
      : `Days ${joinLetters(letters)} done`;
  return `${who} · ${plan.daily_walk}`;
}

function joinLetters(letters: string[]): string {
  if (letters.length === 2) return `${letters[0]} and ${letters[1]}`;
  return `${letters.slice(0, -1).join(", ")} and ${letters[letters.length - 1]}`;
}

function currentPlanWeek(date: string, plan: TrainingPlan): number {
  const meta = weekMetaForDate(date, plan);
  if (meta) return meta.week;
  if (date < plan.start_date) return 1;
  return plan.weeks[plan.weeks.length - 1]?.week ?? 1;
}

function muscleMap(plan: TrainingPlan): Map<string, MuscleGroup> {
  const map = new Map<string, MuscleGroup>();
  const items = [
    ...(plan.slots ?? []).flatMap((slot) => slot.items),
    ...Object.values(plan.days).flatMap((day) => (day.kind === "lift" ? day.items : [])),
  ];
  for (const item of items) {
    if (item.muscle_group && !map.has(item.key)) map.set(item.key, item.muscle_group);
  }
  return map;
}

function liftDayCount(plan: TrainingPlan): number {
  return Object.values(plan.days).filter((day) => day.kind === "lift").length || scheduledTrainingDays(plan);
}

function weightPoints(weights: Array<{ date: string; kg: number }>, _start: string, today: string): number[] {
  return weights
    .filter((row) => row.date <= today)
    .slice(-12)
    .map((row) => row.kg);
}

function formatBandShort(band: string | null): string | null {
  if (!band) return null;
  if (band === "bodyweight") return "BW";
  return band;
}

function formatDayMonth(iso: string): string {
  const date = parseIsoDate(iso);
  const day = new Intl.DateTimeFormat("en-AU", { day: "numeric", timeZone: "UTC" }).format(date);
  const month = new Intl.DateTimeFormat("en-AU", { month: "short", timeZone: "UTC" }).format(date);
  return `${day} ${month}`;
}

function daysBetween(start: string, date: string): number {
  const ms = parseIsoDate(date).getTime() - parseIsoDate(start).getTime();
  return Math.round(ms / 86_400_000);
}

function round1(value: number | null): number | null {
  if (value == null) return null;
  return Math.round(value * 10) / 10;
}

/** Kept so copy text for a weekday plan still has a week label. */
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
