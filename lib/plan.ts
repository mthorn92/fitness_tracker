import planFile from "@/data/plans/2026-11-16-8wk.json";
import { parseIsoDate, shiftIsoDate } from "@/lib/format";
import type {
  PlanItem,
  PlanWeekday,
  PlanWeekType,
  PrescribedDay,
  PrescribedExercise,
  TrainingPlan,
} from "@/lib/types";

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

export function loadTrainingPlan(): TrainingPlan {
  return planFile as TrainingPlan;
}

export function planEndDate(plan: TrainingPlan = loadTrainingPlan()): string {
  return shiftIsoDate(plan.start_date, plan.weeks.length * 7 - 1);
}

/** Monday–Sunday dates for a 1-based block week, or null when the week is outside the plan. */
export function planWeekRange(
  week: number,
  plan: TrainingPlan = loadTrainingPlan(),
): { start: string; end: string } | null {
  if (!plan.weeks.some((entry) => entry.week === week)) return null;
  const start = shiftIsoDate(plan.start_date, (week - 1) * 7);
  return { start, end: shiftIsoDate(start, 6) };
}

export function scheduledTrainingDays(plan: TrainingPlan = loadTrainingPlan()): number {
  return Object.values(plan.days).filter((day) => day.kind !== "rest").length;
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

  const offset = daysBetween(plan.start_date, date);
  if (offset < 0 || offset >= plan.weeks.length * 7) return base;

  const week = Math.floor(offset / 7) + 1;
  const meta = plan.weeks.find((entry) => entry.week === week);
  if (!meta) return base;

  const planDay = WEEKDAYS[parseIsoDate(date).getUTCDay()];
  const day = plan.days[planDay];
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
