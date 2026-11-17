import { asArray, asDate, asId, asNumber, asObject, asString } from "@/lib/api-body";

export type PhaseWrite = {
  id: string;
  name: string;
  kind: string | null;
  start: string;
  end: string | null;
  goal_weight_kg: number | null;
  kcal_target: number | null;
  note: string | null;
};

export function parsePhaseWrite(value: unknown): PhaseWrite | "invalid" {
  const body = asObject(value);
  if (!body) return "invalid";
  return parsePhaseFields(body);
}

export function parsePhaseWrites(body: unknown): PhaseWrite[] | "invalid" {
  if (Array.isArray(body)) {
    const phases: PhaseWrite[] = [];
    for (const item of body) {
      const parsed = parsePhaseWrite(item);
      if (parsed === "invalid") return "invalid";
      phases.push(parsed);
    }
    return phases;
  }
  const one = parsePhaseWrite(body);
  if (one === "invalid") return "invalid";
  return [one];
}

function parsePhaseFields(body: Record<string, unknown>): PhaseWrite | "invalid" {
  const id = asId(body.id);
  const name = asString(body.name, 120);
  const start = asDate(body.start);
  if (!id || !name || !start) return "invalid";

  const endRaw = body.end;
  let end: string | null = null;
  if (endRaw != null) {
    const parsed = asDate(endRaw);
    if (!parsed) return "invalid";
    end = parsed;
    if (end < start) return "invalid";
  }

  const kind = body.kind == null ? null : asString(body.kind, 40);
  if (body.kind != null && kind == null) return "invalid";

  const goal = optionalPositive(body.goal_weight_kg);
  if (body.goal_weight_kg != null && goal == null) return "invalid";

  const kcal = optionalPositiveInt(body.kcal_target);
  if (body.kcal_target != null && kcal == null) return "invalid";

  const note = body.note == null ? null : asString(body.note, 400);
  if (body.note != null && note == null) return "invalid";

  return {
    id,
    name,
    kind,
    start,
    end,
    goal_weight_kg: goal,
    kcal_target: kcal,
    note,
  };
}

function optionalPositive(value: unknown): number | null {
  if (value == null) return null;
  const n = asNumber(value);
  if (n == null || n <= 0 || n > 400) return null;
  return n;
}

function optionalPositiveInt(value: unknown): number | null {
  if (value == null) return null;
  const n = asNumber(value);
  if (n == null || !Number.isInteger(n) || n <= 0 || n > 20_000) return null;
  return n;
}
