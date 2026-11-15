import { asArray, asBoolean, asDate, asId, asNumber, asObject, asString } from "@/lib/api-body";
import type {
  DaySlot,
  MuscleGroup,
  PlanDay,
  PlanItem,
  PlanProgression,
  PlanSlot,
  PlanWeek,
  PlanWeekday,
  PlanWeekType,
  TrainingPlan,
} from "@/lib/types";

const PLAN_ID = /^plan_\d{4}-\d{2}-\d{2}$/;
const WEEKDAYS: PlanWeekday[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const WEEK_TYPES = new Set<PlanWeekType>(["build", "deload", "test"]);
const PROGRESSIONS = new Set<PlanProgression>(["compound", "accessory", "pullup", "none"]);
const MUSCLES = new Set<MuscleGroup>(["chest", "shoulders", "back", "legs", "arms"]);
const SLOTS = new Set<DaySlot>(["a", "b", "c", "d"]);

export type PlanWrite = {
  plan: TrainingPlan;
  active: boolean | null;
};

/** Validate a POST /api/plan body. `active` is optional and is not stored inside the plan. */
export function parsePlanWrite(value: unknown): PlanWrite | { error: string } {
  const body = asObject(value);
  if (!body) return { error: "invalid_json" };

  let active: boolean | null = null;
  if ("active" in body && body.active != null) {
    active = asBoolean(body.active);
    if (active == null) return { error: "invalid_active" };
  }

  const source = asObject(body.plan) ?? body;
  const plan = parsePlan(source);
  if ("error" in plan) return plan;
  return { plan, active };
}

export function parsePlan(value: unknown): TrainingPlan | { error: string } {
  const body = asObject(value);
  if (!body) return { error: "invalid_plan" };

  const id = asId(body.id) ?? asId(body.plan_id);
  if (!id || !PLAN_ID.test(id)) return { error: "invalid_plan_id" };

  const name = asString(body.name, 120);
  if (!name) return { error: "invalid_name" };

  const start_date = asDate(body.start_date);
  if (!start_date) return { error: "invalid_start_date" };

  let end_date: string | undefined;
  if ("end_date" in body && body.end_date != null && body.end_date !== "") {
    const end = asDate(body.end_date);
    if (!end || end < start_date) return { error: "invalid_end_date" };
    end_date = end;
  }

  const daily_walk = asString(body.daily_walk, 80);
  if (!daily_walk) return { error: "invalid_daily_walk" };

  const weeks = parseWeeks(body.weeks);
  if ("error" in weeks) return weeks;

  const deload = parseDeload(body.deload_rule);
  if ("error" in deload) return deload;

  const progression = parseProgression(body.progression);
  if ("error" in progression) return progression;

  const rules = parseRules(body.progression_rules);
  if ("error" in rules) return rules;

  const days = parseDays(body.days);
  if ("error" in days) return days;

  const slots = parseSlots(body.slots);
  if (slots && "error" in slots) return slots;

  const runs = parseRuns(body.runs);
  if (runs && "error" in runs) return runs;

  const walk = parseWalk(body.walk_only, start_date, end_date);
  if (walk && "error" in walk) return walk;

  if (end_date == null && weeks.weeks.some((week) => week.start_date)) {
    return { error: "invalid_end_date" };
  }

  return {
    id,
    name,
    start_date,
    end_date,
    daily_walk,
    weeks: weeks.weeks,
    deload_rule: deload.deload_rule,
    progression: progression.progression,
    progression_rules: rules.rules,
    days: days.days,
    slots: slots ? slots.slots : undefined,
    runs: runs ? runs.runs : undefined,
    walk_only: walk ? walk.walk_only : undefined,
  };
}

function parseWeeks(value: unknown): { weeks: PlanWeek[] } | { error: string } {
  const items = asArray(value, 16);
  if (!items || items.length === 0) return { error: "invalid_weeks" };
  const weeks: PlanWeek[] = [];
  const seen = new Set<number>();
  for (const item of items) {
    const row = asObject(item);
    if (!row) return { error: "invalid_weeks" };
    const week = asNumber(row.week);
    const type = asString(row.type, 12);
    if (week == null || !Number.isInteger(week) || week < 1 || week > 16) return { error: "invalid_weeks" };
    if (!type || !WEEK_TYPES.has(type as PlanWeekType)) return { error: "invalid_weeks" };
    if (seen.has(week)) return { error: "invalid_weeks" };
    seen.add(week);
    let start_date: string | undefined;
    let end_date: string | undefined;
    const hasStart = "start_date" in row && row.start_date != null && row.start_date !== "";
    const hasEnd = "end_date" in row && row.end_date != null && row.end_date !== "";
    if (hasStart !== hasEnd) return { error: "invalid_weeks" };
    if (hasStart) {
      const start = asDate(row.start_date);
      const end = asDate(row.end_date);
      if (!start || !end || end < start) return { error: "invalid_weeks" };
      start_date = start;
      end_date = end;
    }
    weeks.push({ week, type: type as PlanWeekType, start_date, end_date });
  }
  weeks.sort((a, b) => a.week - b.week);
  const dated = weeks.filter((week) => week.start_date);
  if (dated.length !== 0 && dated.length !== weeks.length) return { error: "invalid_weeks" };
  for (let i = 1; i < dated.length; i += 1) {
    const prev = dated[i - 1];
    const next = dated[i];
    if (!prev?.end_date || !next?.start_date || next.start_date <= prev.end_date) return { error: "invalid_weeks" };
  }
  return { weeks };
}

function parseDeload(value: unknown): { deload_rule: TrainingPlan["deload_rule"] } | { error: string } {
  const row = asObject(value);
  if (!row) return { error: "invalid_deload_rule" };
  if (row.sets !== "halve_round_up" || row.load !== "keep") return { error: "invalid_deload_rule" };
  const rir_note = asString(row.rir_note, 200);
  if (!rir_note) return { error: "invalid_deload_rule" };
  return { deload_rule: { sets: "halve_round_up", load: "keep", rir_note } };
}

function parseProgression(value: unknown): { progression: TrainingPlan["progression"] } | { error: string } {
  const row = asObject(value);
  if (!row) return { error: "invalid_progression" };
  const compound = asObject(row.compound);
  const accessory = asObject(row.accessory);
  const pullup = asObject(row.pullup);
  if (!compound || !accessory || !pullup) return { error: "invalid_progression" };
  const compoundReps = numberList(compound.reps, 8);
  const accessoryReps = numberList(accessory.reps, 8);
  if (!compoundReps || !accessoryReps || compound.then !== "add_load_and_reset" || accessory.then !== "add_load_and_reset") {
    return { error: "invalid_progression" };
  }
  const add = asNumber(pullup.add_reps_per_build_week);
  const cap = asNumber(pullup.cap_reps);
  if (add !== 1 || cap == null || !Number.isInteger(cap) || cap < 1 || cap > 30) return { error: "invalid_progression" };
  if (pullup.then !== "lighter_band_and_reset") return { error: "invalid_progression" };
  return {
    progression: {
      compound: { reps: compoundReps, then: "add_load_and_reset" },
      accessory: { reps: accessoryReps, then: "add_load_and_reset" },
      pullup: { add_reps_per_build_week: 1, cap_reps: cap, then: "lighter_band_and_reset" },
    },
  };
}

function parseRules(value: unknown): { rules: string[] } | { error: string } {
  const items = asArray(value, 24);
  if (!items) return { error: "invalid_progression_rules" };
  const rules: string[] = [];
  for (const item of items) {
    const rule = asString(item, 400);
    if (!rule) return { error: "invalid_progression_rules" };
    rules.push(rule);
  }
  return { rules };
}

function parseDays(value: unknown): { days: TrainingPlan["days"] } | { error: string } {
  const row = asObject(value);
  if (!row) return { error: "invalid_days" };
  const days = {} as TrainingPlan["days"];
  for (const weekday of WEEKDAYS) {
    const day = parseDay(row[weekday]);
    if (!day) return { error: "invalid_days" };
    days[weekday] = day;
  }
  return { days };
}

function parseDay(value: unknown): PlanDay | null {
  const row = asObject(value);
  if (!row) return null;
  const label = asString(row.label, 80);
  const kind = asString(row.kind, 12);
  if (!label || !kind) return null;
  if (kind === "rest") {
    const note = optionalText(row.note, 200);
    if (note === "invalid") return null;
    return { label, kind: "rest", note };
  }
  if (kind === "cardio") {
    const min = asNumber(row.duration_min_min);
    const max = asNumber(row.duration_min_max);
    const hr = asNumber(row.hr_cap_bpm);
    if (min == null || max == null || hr == null || min <= 0 || max < min || hr < 40 || hr > 220) return null;
    const note = optionalText(row.note, 200);
    if (note === "invalid") return null;
    return { label, kind: "cardio", duration_min_min: min, duration_min_max: max, hr_cap_bpm: hr, note };
  }
  if (kind !== "lift") return null;
  const items = parseItems(row.items);
  if (!items) return null;
  return { label, kind: "lift", items };
}

function parseSlots(value: unknown): { slots: PlanSlot[] } | { error: string } | null {
  if (value == null) return null;
  const items = asArray(value, 4);
  if (!items || items.length === 0) return { error: "invalid_slots" };
  const slots: PlanSlot[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const row = asObject(item);
    if (!row) return { error: "invalid_slots" };
    const id = asString(row.id, 1);
    const label = asString(row.label, 80);
    if (!id || !SLOTS.has(id as DaySlot) || seen.has(id) || !label) return { error: "invalid_slots" };
    seen.add(id);
    const parsed = parseItems(row.items);
    if (!parsed || parsed.length === 0) return { error: "invalid_slots" };
    slots.push({ id: id as DaySlot, label, items: parsed });
  }
  return { slots };
}

function parseItems(value: unknown): PlanItem[] | null {
  const items = asArray(value, 20);
  if (!items) return null;
  const parsed: PlanItem[] = [];
  for (const item of items) {
    const row = parseItem(item);
    if (!row) return null;
    parsed.push(row);
  }
  return parsed;
}

function parseItem(value: unknown): PlanItem | null {
  const row = asObject(value);
  if (!row) return null;
  const key = asId(row.key);
  const name = asString(row.name, 80);
  const sets = asNumber(row.sets);
  const reps = asNumber(row.reps);
  const progression = asString(row.progression, 12);
  if (!key || !name || sets == null || reps == null || !progression) return null;
  if (!Number.isInteger(sets) || sets < 1 || sets > 20) return null;
  if (reps < 1 || reps > 100) return null;
  if (!PROGRESSIONS.has(progression as PlanProgression)) return null;

  const item: PlanItem = { key, name, sets, reps, progression: progression as PlanProgression };

  const load = optionalNumber(row, "load_kg");
  if (load === "invalid") return null;
  if (load != null) item.load_kg = load;

  const repsMax = optionalNumber(row, "reps_max");
  if (repsMax === "invalid" || (repsMax != null && repsMax < reps)) return null;
  if (repsMax != null) item.reps_max = repsMax;

  const loadMin = optionalNumber(row, "load_kg_min");
  const loadMax = optionalNumber(row, "load_kg_max");
  if (loadMin === "invalid" || loadMax === "invalid") return null;
  if ((loadMin == null) !== (loadMax == null)) return null;
  if (loadMin != null && loadMax != null) {
    if (loadMax < loadMin) return null;
    item.load_kg_min = loadMin;
    item.load_kg_max = loadMax;
  }

  const step = optionalNumber(row, "load_step_kg");
  if (step === "invalid") return null;
  if (step != null) item.load_step_kg = step;

  const hold = optionalNumber(row, "hold_s");
  if (hold === "invalid") return null;
  if (hold != null) item.hold_s = hold;

  const band = optionalText(row.band, 40);
  if (band === "invalid") return null;
  if (band) item.band = band;

  const group = optionalText(row.group, 8);
  if (group === "invalid") return null;
  if (group) item.group = group;

  const extra = optionalText(row.extra, 40);
  if (extra === "invalid") return null;
  if (extra) item.extra = extra;

  if ("muscle_group" in row && row.muscle_group != null && row.muscle_group !== "") {
    const muscle = asString(row.muscle_group, 12);
    if (!muscle || !MUSCLES.has(muscle as MuscleGroup)) return null;
    item.muscle_group = muscle as MuscleGroup;
  }

  return item;
}

function parseRuns(value: unknown): { runs: NonNullable<TrainingPlan["runs"]> } | { error: string } | null {
  if (value == null) return null;
  const row = asObject(value);
  if (!row) return { error: "invalid_runs" };
  const per_week = asNumber(row.per_week);
  const label = asString(row.label, 40);
  const min = asNumber(row.duration_min_min);
  const max = asNumber(row.duration_min_max);
  const hr = asNumber(row.hr_cap_bpm);
  if (per_week == null || !Number.isInteger(per_week) || per_week < 0 || per_week > 7) return { error: "invalid_runs" };
  if (!label || min == null || max == null || hr == null || min <= 0 || max < min || hr < 40 || hr > 220) {
    return { error: "invalid_runs" };
  }
  const note = optionalText(row.note, 240);
  if (note === "invalid") return { error: "invalid_runs" };
  const alert = optionalNumber(row, "hr_alert_bpm");
  const low = optionalNumber(row, "hr_target_low_bpm");
  const high = optionalNumber(row, "hr_target_high_bpm");
  if (alert === "invalid" || low === "invalid" || high === "invalid") return { error: "invalid_runs" };
  return {
    runs: {
      per_week,
      label,
      duration_min_min: min,
      duration_min_max: max,
      hr_cap_bpm: hr,
      hr_alert_bpm: alert ?? undefined,
      hr_target_low_bpm: low ?? undefined,
      hr_target_high_bpm: high ?? undefined,
      note,
    },
  };
}

function parseWalk(
  value: unknown,
  start: string,
  end: string | undefined,
): { walk_only: NonNullable<TrainingPlan["walk_only"]> } | { error: string } | null {
  if (value == null) return null;
  const row = asObject(value);
  if (!row) return { error: "invalid_walk_only" };
  const start_date = asDate(row.start_date);
  const end_date = asDate(row.end_date);
  const note = asString(row.note, 80);
  if (!start_date || !end_date || end_date < start_date || !note) return { error: "invalid_walk_only" };
  if (start_date < start || (end && end_date > end)) return { error: "invalid_walk_only" };
  return { walk_only: { start_date, end_date, note } };
}

function numberList(value: unknown, max: number): number[] | null {
  const items = asArray(value, max);
  if (!items || items.length === 0) return null;
  const numbers: number[] = [];
  for (const item of items) {
    const parsed = asNumber(item);
    if (parsed == null || parsed < 1 || parsed > 100) return null;
    numbers.push(parsed);
  }
  return numbers;
}

function optionalNumber(row: Record<string, unknown>, key: string): number | null | "invalid" {
  if (!(key in row) || row[key] == null || row[key] === "") return null;
  const value = asNumber(row[key]);
  if (value == null || value < 0) return "invalid";
  return value;
}

function optionalText(value: unknown, max: number): string | undefined | "invalid" {
  if (value == null || value === "") return undefined;
  const text = asString(value, max);
  if (!text) return "invalid";
  return text;
}
