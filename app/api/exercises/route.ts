import { asDate, asId, asNumber, asObject, asString, asTime } from "@/lib/api-body";
import { json, requireLogAccess } from "@/lib/auth";
import { upsertExercise } from "@/lib/store";

export async function POST(request: Request) {
  const access = await requireLogAccess(request);
  if (access instanceof Response) return access;

  const body = asObject(await request.json().catch(() => null));
  if (!body) return json({ error: "invalid_json" }, 400);

  const date = asDate(body.date);
  const item = asString(body.item, 240);
  if (!date || !item) return json({ error: "invalid_exercise" }, 400);

  const saved = await upsertExercise({
    id: asId(body.id) ?? undefined,
    date,
    time: asTime(body.time),
    item,
    duration_min: asNumber(body.duration_min),
    kcal: asNumber(body.kcal) ?? 0,
    whoop_id: asString(body.whoop_id, 80),
  });
  return json(saved, body.id ? 200 : 201);
}
