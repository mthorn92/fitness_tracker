import activeFile from "@/data/plans/active.json";
import plan20261115 from "@/data/plans/2026-11-15-5wk.json";
import plan20261116 from "@/data/plans/2026-11-16-8wk.json";
import { parseIsoDate, shiftIsoDate } from "@/lib/format";
import type {
  PlanItem,
  PlanSlot,
  PlanWeek,
  PlanWeekday,
  PlanWeekType,
  PrescribedDay,
  PrescribedExercise,
  TrainingPlan,
} from "@/lib/types";

/** Repo JSON. A stored plan with the same id replaces the file. See loadActiveTrainingPlan. */
export const REPO_PLANS: TrainingPlan[] = [
  plan20261115 as TrainingPlan,
  plan20261116 as TrainingPlan,
];

export const REPO_ACTIVE_PLAN_ID = activeFile.id;

/**
 * Prescriptions follow the plan calendar only.
 *
 * Week 1 starts on `start_date` (Monday 16 Nov 2026). Each build week moves
 * the rep ladder. A deload week repeats the previous build week's reps, load
 * and band, then halves the sets (rounded up). Logged sessions are not read
 * here, so a missed week does not shift the block.
 *
 * Accessory ladders apply when the exercise starts on the ladder's first rep
 * count (10). Other accessory rep counts stay as written. Banded pull-ups add
 * one rep per build week until the cap, then the next build week uses a
 * lighter band and starts again. Load increases only when `load_step_kg` is set.
 */

const WEEKDAYS: PlanWeekday[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export function loadRepoTrainingPlan(id = REPO_ACTIVE_PLAN_ID): TrainingPlan {
  const found = REPO_PLANS.find((plan) => plan.id === id);
  if (!found) throw new Error(`Missing repo plan ${id}`);
  return found;
}

/** Active plan from repo JSON. Stored plans, when present, are applied by loadActiveTrainingPlan. */
export function loadTrainingPlan(): TrainingPlan {
  return loadRepoTrainingPlan();
}

export function planUsesDatedWeeks(plan: TrainingPlan): boolean {
  return plan.weeks.length > 0 && plan.weeks.every((week) => week.start_date && week.end_date);
}

export function planEndDate(plan: TrainingPlan = loadTrainingPlan()): string {
  if (plan.end_date) return plan.end_date;
  return shiftIsoDate(plan.start_date, plan.weeks.length * 7 - 1);
}

/** Inclusive dates for a 1-based block week, or null when the week is outside the plan. */
export function planWeekRange(
  week: number,
  plan: TrainingPlan = loadTrainingPlan(),
): { start: string; end: string } | null {
  const meta = plan.weeks.find((entry) => entry.week === week);
  if (!meta) return null;
  if (meta.start_date && meta.end_date) return { start: meta.start_date, end: meta.end_date };
  if (planUsesDatedWeeks(plan)) return null;
  const start = shiftIsoDate(plan.start_date, (week - 1) * 7);
  return { start, end: shiftIsoDate(start, 6) };
}

export function weekMetaForDate(date: string, plan: TrainingPlan): PlanWeek | null {
  if (planUsesDatedWeeks(plan)) {
    return (
      plan.weeks.find(
        (week) => week.start_date && week.end_date && date >= week.start_date && date <= week.end_date,
      ) ?? null
    );
  }
  const offset = daysBetween(plan.start_date, date);
  if (offset < 0 || offset >= plan.weeks.length * 7) return null;
  const week = Math.floor(offset / 7) + 1;
  return plan.weeks.find((entry) => entry.week === week) ?? null;
}

export function scheduledTrainingDays(plan: TrainingPlan = loadTrainingPlan()): number {
  if (plan.slots && plan.slots.length > 0) return plan.slots.length;
  return Object.values(plan.days).filter((day) => day.kind !== "rest").length;
}

/** Prescription for one flexible day in a block week. Test weeks cap sets at 2. */
export function prescribeSlot(slot: PlanSlot, week: number, plan: TrainingPlan): PrescribedExercise[] {
  const meta = plan.weeks.find((entry) => entry.week === week);
  const weekType = meta?.type ?? "build";
  const buildIndex = buildWeekIndex(plan, week);
  return slot.items.map((item) => prescribeItem(item, buildIndex, weekType, plan));
}

export function prescribeDay(date: string, plan: TrainingPlan = loadTrainingPlan()): PrescribedDay {
  const end = planEndDate(plan);
  const base: PrescribedDay = {
    date,
    plan_id: plan.id,
    plan_name: plan.name,
    start_date: plan.start_date,
    end_date: end,
    in_block: false,
    week: null,
    weeks_in_block: plan.weeks.length,
    week_type: null,
    plan_day: null,
    label: null,
    kind: null,
    deload_note: null,
    daily_walk: plan.daily_walk,
    items: [],
    cardio: null,
    note: null,
  };

  if (date < plan.start_date || date > end) return base;

  const walk = plan.walk_only;
  if (walk && date >= walk.start_date && date <= walk.end_date) {
    base.in_block = true;
    base.note = walk.note;
    base.kind = "rest";
    base.label = "Walks only";
    base.plan_day = WEEKDAYS[parseIsoDate(date).getUTCDay()];
    return base;
  }

  const meta = weekMetaForDate(date, plan);
  if (!meta) {
    base.in_block = true;
    base.plan_day = WEEKDAYS[parseIsoDate(date).getUTCDay()];
    base.kind = "rest";
    base.label = plan.daily_walk;
    base.note = plan.daily_walk;
    return base;
  }

  const week = meta.week;

  const planDay = WEEKDAYS[parseIsoDate(date).getUTCDay()];
  const day = plan.days[planDay];
  if (!day) return base;
  const weekType = meta.type;
  const buildIndex = buildWeekIndex(plan, week);

  base.in_block = true;
  base.week = week;
  base.week_type = weekType;
  base.plan_day = planDay;
  base.label = day.label;
  base.kind = day.kind;
  base.note = "note" in day && day.note ? day.note : null;
  base.deload_note = weekType === "deload" && day.kind === "lift" ? plan.deload_rule.rir_note : null;

  if (day.kind === "lift") {
    base.items = day.items.map((item) => prescribeItem(item, buildIndex, weekType, plan));
  } else if (day.kind === "cardio") {
    base.cardio = {
      duration_min_min: day.duration_min_min,
      duration_min_max: day.duration_min_max,
      hr_cap_bpm: day.hr_cap_bpm,
    };
  }

  return base;
}

function buildWeekIndex(plan: TrainingPlan, week: number): number {
  let count = 0;
  for (const entry of plan.weeks) {
    if (entry.week > week) break;
    if (entry.type === "build" && entry.week <= week) count += 1;
  }
  return Math.max(1, count);
}

function prescribeItem(
  item: PlanItem,
  buildIndex: number,
  weekType: PlanWeekType,
  plan: TrainingPlan,
): PrescribedExercise {
  let reps = item.reps;
  let load = item.load_kg ?? null;
  let band = item.band ?? null;
  const index = Math.max(0, buildIndex - 1);

  if (item.progression === "compound") {
    const ladder = plan.progression.compound.reps;
    const span = ladder.length;
    const cycle = Math.floor(index / span);
    reps = ladder[index % span] ?? item.reps;
    load = addLoad(load, item.load_step_kg, cycle);
  } else if (item.progression === "accessory") {
    const ladder = plan.progression.accessory.reps;
    if (ladder.length > 0 && item.reps === ladder[0]) {
      const span = ladder.length;
      const cycle = Math.floor(index / span);
      reps = ladder[index % span] ?? item.reps;
      load = addLoad(load, item.load_step_kg, cycle);
    }
  } else if (item.progression === "pullup") {
    const cap = plan.progression.pullup.cap_reps;
    const stepped = item.reps + index * plan.progression.pullup.add_reps_per_build_week;
    if (band) {
      const span = Math.max(1, cap - item.reps + 1);
      const cycle = Math.floor(index / span);
      reps = item.reps + (index % span);
      band = lighterBand(band, cycle);
    } else {
      reps = Math.min(cap, stepped);
    }
  }

  let sets = item.sets;
  if (weekType === "deload" && plan.deload_rule.sets === "halve_round_up") {
    sets = Math.ceil(sets / 2);
  }
  if (weekType === "test") sets = Math.min(sets, 2);

  const loadUnchanged = load === (item.load_kg ?? null);
  return {
    key: item.key,
    name: item.name,
    sets,
    reps,
    load_kg: load,
    band,
    hold_s: item.hold_s ?? null,
    group: item.group ?? null,
    extra: item.extra ?? null,
    progression: item.progression,
    reps_max: reps === item.reps ? (item.reps_max ?? null) : null,
    load_kg_min: loadUnchanged ? (item.load_kg_min ?? null) : null,
    load_kg_max: loadUnchanged ? (item.load_kg_max ?? null) : null,
    muscle_group: item.muscle_group ?? null,
  };
}

function addLoad(load: number | null, step: number | undefined, cycles: number): number | null {
  if (load == null || step == null || cycles <= 0) return load;
  return round1(load + cycles * step);
}

function lighterBand(band: string, drops: number): string {
  let current = band;
  for (let i = 0; i < drops; i += 1) current = stepDownBand(current);
  return current;
}

function stepDownBand(band: string): string {
  const match = /^(\d+)\s+red$/.exec(band);
  if (!match) return band === "bodyweight" ? band : "lighter band";
  const count = Number(match[1]);
  if (count > 1) return `${count - 1} red`;
  return "bodyweight";
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function daysBetween(start: string, date: string): number {
  const ms = parseIsoDate(date).getTime() - parseIsoDate(start).getTime();
  return Math.round(ms / 86_400_000);
}
