import { asNumber, asObject, asString } from "@/lib/api-body";
import { json, requireLogAccess } from "@/lib/auth";
import { loadSnapshot, updateTargets } from "@/lib/store";

export async function GET(request: Request) {
  const access = await requireLogAccess(request);
  if (access instanceof Response) return access;
  const snapshot = await loadSnapshot();
  return json({
    goal_weight_kg: snapshot.goal_weight_kg,
    start_weight_kg: snapshot.start_weight_kg,
    start_date: snapshot.start_date,
    targets: snapshot.targets,
  });
}

export async function PUT(request: Request) {
  const access = await requireLogAccess(request);
  if (access instanceof Response) return access;
  const body = asObject(await request.json().catch(() => null));
  if (!body) return json({ error: "invalid_json" }, 400);

  const snapshot = await loadSnapshot();
  const calories = asNumber(body.calories_kcal) ?? snapshot.targets.calories_kcal;
  const water = asNumber(body.water_l) ?? snapshot.targets.water_l;
  const protein = asNumber(body.protein_g) ?? snapshot.targets.protein_g;
  const carbs = asNumber(body.carbs_g) ?? snapshot.targets.carbs_g;
  const fat = asNumber(body.fat_g) ?? snapshot.targets.fat_g;
  const fasting = asString(body.fasting, 160) ?? snapshot.targets.fasting;
  const goal = asNumber(body.goal_weight_kg);

  await updateTargets({
    calories_kcal: calories,
    water_l: water,
    fasting,
    protein_g: protein,
    carbs_g: carbs,
    fat_g: fat,
    goal_weight_kg: goal ?? undefined,
  });
  return json({ ok: true });
}
