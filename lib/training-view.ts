import { formatShortDate } from "@/lib/format";
import { planWeekRange, prescribeDay, scheduledTrainingDays } from "@/lib/plan";
import { listSessions } from "@/lib/store";
import type { PrescribedDay, PrescribedExercise, SessionSet, TrainingSession } from "@/lib/types";

export type TrainingRow = {
  key: string;
  name: string;
  prescription: string;
  logged: string | null;
};

export type TrainingGroup = {
  letter: string | null;
  rows: TrainingRow[];
};

export type TrainingTile = {
  date: string;
  dateLabel: string;
  heading: string;
  state: "before" | "after" | "planned" | "completed";
  planName: string;
  weekLabel: string | null;
  dayLabel: string | null;
  kindLabel: string | null;
  deloadNote: string | null;
  dailyWalk: string | null;
  restNote: string | null;
  cardioText: string | null;
  loggedCardio: string | null;
  groups: TrainingGroup[];
  rpe: number | null;
  feedback: string | null;
};

export async function getTrainingTile(date: string): Promise<TrainingTile> {
  const prescribed = prescribeDay(date);
  const completed = prescribed.in_block ? await completedSession(date) : null;
  const weekLabel = prescribed.in_block ? await weekLabelFor(prescribed) : null;
  const heading = "Today's training";
  const dateLabel = formatShortDate(date);

  if (!prescribed.in_block) {
    const before = date < prescribed.start_date;
    return {
      date,
      dateLabel,
      heading,
      state: before ? "before" : "after",
      planName: prescribed.plan_name,
      weekLabel: null,
      dayLabel: null,
      kindLabel: null,
      deloadNote: null,
      dailyWalk: prescribed.daily_walk,
      restNote: before
        ? `${prescribed.plan_name} starts ${formatShortDate(prescribed.start_date)}.`
        : `${prescribed.plan_name} ended ${formatShortDate(prescribed.end_date)}.`,
      cardioText: null,
      loggedCardio: null,
      groups: [],
      rpe: null,
      feedback: null,
    };
  }

  const groups = groupRows(prescribed, completed);
  const cardioText = prescribed.cardio
    ? `${prescribed.cardio.duration_min_min}–${prescribed.cardio.duration_min_max} min · heart rate under ${prescribed.cardio.hr_cap_bpm} bpm`
    : null;

  return {
    date,
    dateLabel,
    heading,
    state: completed ? "completed" : "planned",
    planName: prescribed.plan_name,
    weekLabel,
    dayLabel: prescribed.label,
    kindLabel: prescribed.week_type,
    deloadNote: prescribed.deload_note,
    dailyWalk: prescribed.daily_walk,
    restNote: prescribed.kind === "rest" ? prescribed.note : null,
    cardioText,
    loggedCardio: completed && prescribed.kind === "cardio" ? formatLoggedCardio(completed) : null,
    groups,
    rpe: completed?.rpe ?? null,
    feedback: completed?.feedback ?? null,
  };
}

async function completedSession(date: string): Promise<TrainingSession | null> {
  const sessions = await listSessions({ date });
  const done = sessions.filter((session) => session.completed);
  return done[done.length - 1] ?? null;
}

async function weekLabelFor(day: PrescribedDay): Promise<string | null> {
  if (day.week == null || day.week_type == null) return null;
  const range = planWeekRange(day.week);
  if (!range) return null;
  const sessions = await listSessions({ from: range.start, to: range.end });
  const doneDates = new Set(sessions.filter((session) => session.completed).map((session) => session.date));
  let done = 0;
  for (const date of doneDates) {
    const prescribed = prescribeDay(date);
    if (prescribed.in_block && prescribed.week === day.week && prescribed.kind !== "rest") done += 1;
  }
  const scheduled = scheduledTrainingDays();
  return `Week ${day.week} of ${day.weeks_in_block} · ${day.week_type} · ${done}/${scheduled} sessions`;
}

function groupRows(day: PrescribedDay, session: TrainingSession | null): TrainingGroup[] {
  const logged = new Map<string, SessionSet[]>();
  for (const set of session?.sets ?? []) {
    const list = logged.get(set.exercise_key) ?? [];
    list.push(set);
    logged.set(set.exercise_key, list);
  }

  const groups: TrainingGroup[] = [];
  for (const item of day.items) {
    const letter = supersetLetter(item.group);
    const row: TrainingRow = {
      key: item.key,
      name: item.name,
      prescription: formatPrescription(item),
      logged: session ? formatLoggedSets(logged.get(item.key) ?? [], item.sets) : null,
    };
    logged.delete(item.key);
    const last = groups[groups.length - 1];
    if (letter && last?.letter === letter) last.rows.push(row);
    else groups.push({ letter, rows: [row] });
  }

  for (const [key, sets] of logged) {
    const name = key.replace(/_/g, " ");
    groups.push({
      letter: null,
      rows: [
        {
          key,
          name,
          prescription: "Extra",
          logged: formatLoggedSets(sets, sets.length),
        },
      ],
    });
  }

  return groups;
}

function supersetLetter(group: string | null): string | null {
  if (!group) return null;
  const match = /^([A-Za-z]+)\d*$/.exec(group);
  return match ? match[1].toUpperCase() : group;
}

export function formatPrescription(item: PrescribedExercise): string {
  if (item.extra === "attempt") return `${item.sets} attempts`;
  const dose = timedDose(item) ?? `${item.sets} × ${formatCount(item.reps)}${extraSuffix(item.extra)}`;
  const load = item.load_kg == null ? "" : ` @ ${formatCount(item.load_kg)} kg${perHand(item.extra)}`;
  const band = item.band ? ` · ${formatBand(item.band)}` : "";
  return `${dose}${load}${band}`;
}

function timedDose(item: PrescribedExercise): string | null {
  if (item.hold_s == null) return null;
  return `${item.sets} × ${formatCount(item.hold_s)}s`;
}

function extraSuffix(extra: string | null): string {
  if (extra === "per leg") return "/leg";
  return "";
}

function perHand(extra: string | null): string {
  return extra === "per hand" ? "/hand" : "";
}

function formatBand(band: string): string {
  if (band === "bodyweight") return "bodyweight";
  const match = /^(\d+) red$/.exec(band);
  if (!match) return band;
  return `${match[1]} red ${match[1] === "1" ? "band" : "bands"}`;
}

function formatLoggedSets(sets: SessionSet[], plannedSets: number): string {
  if (sets.length === 0) return "not logged";
  const ordered = [...sets].sort((a, b) => a.set - b.set);
  const doneSets = ordered.filter((set) => set.done);
  const loads = new Set(doneSets.map((set) => set.load_kg).filter((load) => load != null));
  const bands = new Set(doneSets.map((set) => set.band).filter((band): band is string => Boolean(band)));
  const timed = doneSets.some((set) => set.hold_s != null && (set.reps == null || set.reps <= 1));
  if (!timed && loads.size <= 1 && bands.size <= 1) {
    const reps = ordered.map((set) => (set.done ? (set.reps == null ? "—" : formatCount(set.reps)) : "skipped"));
    const load = loads.size === 1 ? ` @ ${formatCount([...loads][0] as number)} kg` : "";
    const band = bands.size === 1 ? ` · ${formatBand([...bands][0] as string)}` : "";
    return `${reps.join(", ")}${load}${band} · ${doneSets.length}/${plannedSets}`;
  }
  const bits = ordered.map((set) => {
    if (!set.done) return "skipped";
    if (set.hold_s != null && (set.reps == null || set.reps <= 1)) return `${formatCount(set.hold_s)}s`;
    const reps = set.reps == null ? "—" : formatCount(set.reps);
    const load = set.load_kg == null ? "" : ` @ ${formatCount(set.load_kg)} kg`;
    const band = set.band ? ` · ${formatBand(set.band)}` : "";
    return `${reps}${load}${band}`;
  });
  return `${bits.join(", ")} · ${doneSets.length}/${plannedSets}`;
}

function formatLoggedCardio(session: TrainingSession): string {
  const parts: string[] = [];
  if (session.duration_min != null) parts.push(`${formatCount(session.duration_min)} min`);
  if (session.avg_hr != null) parts.push(`avg HR ${formatCount(session.avg_hr)}`);
  return parts.length > 0 ? parts.join(" · ") : "Logged";
}

function formatCount(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}
