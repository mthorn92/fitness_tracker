import { asBoolean, asDate, asId, asNumber, asObject, asString, asTime } from "@/lib/api-body";
import { json, requireLogAccess } from "@/lib/auth";
import { upsertWater } from "@/lib/store";

export async function POST(request: Request) {
  const access = await requireLogAccess(request);
  if (access instanceof Response) return access;

  const body = asObject(await request.json().catch(() => null));
  if (!body) return json({ error: "invalid_json" }, 400);

  const date = asDate(body.date);
  const time = asTime(body.time);
  const item = asString(body.item, 240);
  const litres = asNumber(body.litres);
  if (!date || !time || !item || litres == null) {
    return json({ error: "invalid_water" }, 400);
  }

  const saved = await upsertWater({
    id: asId(body.id) ?? undefined,
    date,
    time,
    item,
    litres,
    estimated: asBoolean(body.estimated) ?? false,
  });
  return json(saved, body.id ? 200 : 201);
}
