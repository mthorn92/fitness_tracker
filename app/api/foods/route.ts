import { asDate, asId, asNumber, asObject, asString, asTime } from "@/lib/api-body";
import { json, requireLogAccess } from "@/lib/auth";
import { upsertFood } from "@/lib/store";

export async function POST(request: Request) {
  const access = await requireLogAccess(request);
  if (access instanceof Response) return access;

  const body = asObject(await request.json().catch(() => null));
  if (!body) return json({ error: "invalid_json" }, 400);

  const date = asDate(body.date);
  const time = asTime(body.time);
  const item = asString(body.item, 240);
  const kcal = asNumber(body.kcal);
  const protein_g = asNumber(body.protein_g) ?? 0;
  const carbs_g = asNumber(body.carbs_g) ?? 0;
  const fat_g = asNumber(body.fat_g) ?? 0;
  if (!date || !time || !item || kcal == null) {
    return json({ error: "invalid_food" }, 400);
  }

  const saved = await upsertFood({
    id: asId(body.id) ?? undefined,
    date,
    time,
    item,
    kcal,
    protein_g,
    carbs_g,
    fat_g,
    saved_meal: asString(body.saved_meal, 120),
  });
  return json(saved, body.id ? 200 : 201);
}
