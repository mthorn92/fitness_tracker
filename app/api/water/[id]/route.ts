import { asBoolean, asDate, asNumber, asObject, asString, asTime } from "@/lib/api-body";
import { json, requireLogAccess } from "@/lib/auth";
import { sql } from "@/lib/db";
import { deleteWater, ensureStore, upsertWater } from "@/lib/store";

type WaterRow = {
  id: string;
  date: string;
  time: string;
  item: string;
  litres: number;
  estimated: boolean;
};

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireLogAccess(request);
  if (access instanceof Response) return access;
  const { id } = await params;
  await ensureStore();
  const [row] = await sql<WaterRow>("select * from water_entries where id = $1", [id]);
  if (!row) return json({ error: "not_found" }, 404);

  const body = asObject(await request.json().catch(() => null));
  if (!body) return json({ error: "invalid_json" }, 400);

  const saved = await upsertWater({
    id,
    date: asDate(body.date) ?? row.date,
    time: asTime(body.time) ?? row.time,
    item: asString(body.item, 240) ?? row.item,
    litres: asNumber(body.litres) ?? Number(row.litres),
    estimated: asBoolean(body.estimated) ?? Boolean(row.estimated),
  });
  return json(saved);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireLogAccess(request);
  if (access instanceof Response) return access;
  const { id } = await params;
  const deleted = await deleteWater(id);
  if (!deleted) return json({ error: "not_found" }, 404);
  return json({ ok: true });
}
