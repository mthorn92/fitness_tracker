import { asDate, asId, asNumber, asObject } from "@/lib/api-body";
import { json, requireLogAccess } from "@/lib/auth";
import { upsertWeight } from "@/lib/store";

export async function POST(request: Request) {
  const access = await requireLogAccess(request);
  if (access instanceof Response) return access;

  const body = asObject(await request.json().catch(() => null));
  if (!body) return json({ error: "invalid_json" }, 400);

  const date = asDate(body.date);
  const kg = asNumber(body.kg);
  if (!date || kg == null) return json({ error: "invalid_weight" }, 400);

  const saved = await upsertWeight({
    id: asId(body.id) ?? undefined,
    date,
    kg,
  });
  return json(saved);
}
