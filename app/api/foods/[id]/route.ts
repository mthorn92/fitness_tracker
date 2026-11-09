import { asDate, asNumber, asObject, asString, asTime } from "@/lib/api-body";
import { json, requireLogAccess } from "@/lib/auth";
import { sql } from "@/lib/db";
import { deleteFood, ensureStore, upsertFood } from "@/lib/store";

type FoodRow = {
  id: string;
  date: string;
  time: string;
  item: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  meal: string | null;
  saved_meal: string | null;
};

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireLogAccess(request);
  if (access instanceof Response) return access;

  const { id } = await params;
  await ensureStore();
  const [row] = await sql<FoodRow>("select * from foods where id = $1", [id]);
  if (!row) return json({ error: "not_found" }, 404);

  const body = asObject(await request.json().catch(() => null));
  if (!body) return json({ error: "invalid_json" }, 400);

  const saved = await upsertFood({
    id,
    date: asDate(body.date) ?? row.date,
    time: asTime(body.time) ?? row.time,
    item: asString(body.item, 240) ?? row.item,
    kcal: asNumber(body.kcal) ?? Number(row.kcal),
    protein_g: asNumber(body.protein_g) ?? Number(row.protein_g),
    carbs_g: asNumber(body.carbs_g) ?? Number(row.carbs_g),
    fat_g: asNumber(body.fat_g) ?? Number(row.fat_g),
    meal: asString(body.meal, 40) ?? row.meal,
    saved_meal: asString(body.saved_meal, 120) ?? row.saved_meal,
  });
  return json(saved);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireLogAccess(request);
  if (access instanceof Response) return access;
  const { id } = await params;
  const deleted = await deleteFood(id);
  if (!deleted) return json({ error: "not_found" }, 404);
  return json({ ok: true });
}
