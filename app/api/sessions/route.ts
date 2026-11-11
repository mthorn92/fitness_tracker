import { asArray, asBoolean, asDate, asId, asNumber, asObject, asString } from "@/lib/api-body";
import { json, requireLogAccess } from "@/lib/auth";
import { listSessions, nextSessionId, upsertSession } from "@/lib/store";
import type { PlanWeekday, SessionSet, TrainingSession } from "@/lib/types";

const SESSION_ID = /^session_(\d{4}-\d{2}-\d{2})_(\d{2})$/;
const PLAN_DAYS = new Set(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);

export async function GET(request: Request) {
  const access = await requireLogAccess(request);
  if (access instanceof Response) return access;

  const params = new URL(request.url).searchParams;
  const date = params.get("date");
  const from = params.get("from");
  const to = params.get("to");

  if (date != null && date !== "" && (from != null || to != null)) {
    return json({ error: "invalid_range", message: "Use either date or from and to." }, 400);
  }
  if ((from == null) !== (to == null) && date == null) {
    return json({ error: "invalid_range", message: "from and to are both required." }, 400);
  }

  if (date != null && date !== "") {
    const parsed = asDate(date);
    if (!parsed) return json({ error: "invalid_date" }, 400);
    const sessions = await listSessions({ date: parsed });
    return json({ sessions });
  }

  if (from != null || to != null) {
    const start = asDate(from ?? undefined);
    const end = asDate(to ?? undefined);
    if (!start || !end) return json({ error: "invalid_date" }, 400);
    if (start > end) return json({ error: "invalid_range", message: "from is after to." }, 400);
    const sessions = await listSessions({ from: start, to: end });
    return json({ sessions });
  }

  return json({ sessions: await listSessions() });
}

export async function POST(request: Request) {
  const access = await requireLogAccess(request);
  if (access instanceof Response) return access;

  const body = asObject(await request.json().catch(() => null));
  if (!body) return json({ error: "invalid_json" }, 400);

  const date = asDate(body.date);
  if (!date) return json({ error: "invalid_date" }, 400);

  let id = asId(body.id);
  if ("id" in body && body.id != null && body.id !== "") {
    if (!id || !SESSION_ID.test(id)) {
      return json({ error: "invalid_id", message: "id must look like session_YYYY-MM-DD_NN." }, 400);
    }
    const match = SESSION_ID.exec(id);
    if (!match || match[1] !== date) {
      return json({ error: "invalid_id", message: "id date must match date." }, 400);
    }
  } else {
    id = await nextSessionId(date);
  }

  let plan_id: string | null = null;
  if ("plan_id" in body && body.plan_id != null && body.plan_id !== "") {
    plan_id = asId(body.plan_id);
    if (!plan_id) return json({ error: "invalid_plan_id" }, 400);
  }

  let plan_day: PlanWeekday | null = null;
  if ("plan_day" in body && body.plan_day != null && body.plan_day !== "") {
    const day = asString(body.plan_day, 3);
    if (!day || !PLAN_DAYS.has(day)) return json({ error: "invalid_plan_day" }, 400);
    plan_day = day as PlanWeekday;
  }

  if (!("completed" in body)) return json({ error: "invalid_completed" }, 400);
  const completed = asBoolean(body.completed);
  if (completed == null) return json({ error: "invalid_completed" }, 400);

  let rpe: number | null = null;
  if ("rpe" in body && body.rpe != null && body.rpe !== "") {
    rpe = asNumber(body.rpe);
    if (rpe == null || rpe < 1 || rpe > 10) return json({ error: "invalid_rpe" }, 400);
  }

  let feedback: string | null = null;
  if ("feedback" in body && body.feedback != null && body.feedback !== "") {
    feedback = asString(body.feedback, 2000);
    if (!feedback) return json({ error: "invalid_feedback" }, 400);
  }

  const sets = parseSets(body.sets);
  if (sets === "invalid") return json({ error: "invalid_sets" }, 400);

  let duration_min: number | null = null;
  if ("duration_min" in body && body.duration_min != null && body.duration_min !== "") {
    duration_min = asNumber(body.duration_min);
    if (duration_min == null || duration_min <= 0 || duration_min > 600) {
      return json({ error: "invalid_duration_min" }, 400);
    }
  }

  let avg_hr: number | null = null;
  if ("avg_hr" in body && body.avg_hr != null && body.avg_hr !== "") {
    avg_hr = asNumber(body.avg_hr);
    if (avg_hr == null || avg_hr < 1 || avg_hr > 250) return json({ error: "invalid_avg_hr" }, 400);
  }

  const session: TrainingSession = {
    id,
    date,
    plan_id,
    plan_day,
    completed,
    rpe,
    feedback,
    sets,
    duration_min,
    avg_hr,
  };
  const saved = await upsertSession(session);
  return json(saved.session, saved.created ? 201 : 200);
}

function parseSets(value: unknown): SessionSet[] | "invalid" {
  if (value == null) return [];
  const items = asArray(value, 80);
  if (!items) return "invalid";
  const sets: SessionSet[] = [];
  for (const item of items) {
    const row = asObject(item);
    if (!row) return "invalid";
    const exercise_key = asId(row.exercise_key);
    const set = asNumber(row.set);
    if (!exercise_key || set == null || !Number.isInteger(set) || set < 1) return "invalid";
    if (!("done" in row)) return "invalid";
    const done = asBoolean(row.done);
    if (done == null) return "invalid";
    const reps = optionalNumber(row, "reps");
    if (reps === "invalid") return "invalid";
    const load_kg = optionalNumber(row, "load_kg");
    if (load_kg === "invalid") return "invalid";
    const hold_s = optionalNumber(row, "hold_s");
    if (hold_s === "invalid") return "invalid";
    let band: string | null = null;
    if ("band" in row && row.band != null && row.band !== "") {
      band = asString(row.band, 40);
      if (!band) return "invalid";
    }
    sets.push({ exercise_key, set, reps, load_kg, band, hold_s, done });
  }
  return sets;
}

function optionalNumber(row: Record<string, unknown>, key: string): number | null | "invalid" {
  if (!(key in row) || row[key] == null || row[key] === "") return null;
  const value = asNumber(row[key]);
  if (value == null || value < 0) return "invalid";
  return value;
}
