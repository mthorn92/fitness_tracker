import { json, requireLogAccess } from "@/lib/auth";
import { loadPlanCatalog } from "@/lib/plan-store";
import { parsePlanWrite } from "@/lib/plan-validate";
import { upsertStoredPlan } from "@/lib/store";

/** Active plan plus every known plan id. Stored rows win over the repo JSON. */
export async function GET(request: Request) {
  const access = await requireLogAccess(request);
  if (access instanceof Response) return access;

  const catalog = await loadPlanCatalog();
  return json({
    active_plan_id: catalog.active.id,
    plan_ids: catalog.ids,
    plan: catalog.active,
  });
}

/** Upsert one plan by id. Pass active: true to make it the plan the Exercise tab shows. */
export async function POST(request: Request) {
  const access = await requireLogAccess(request);
  if (access instanceof Response) return access;

  const parsed = parsePlanWrite(await request.json().catch(() => null));
  if ("error" in parsed) return json({ error: parsed.error }, 400);

  const saved = await upsertStoredPlan(parsed.plan.id, parsed.plan, parsed.active);
  const catalog = await loadPlanCatalog();
  const isActive = catalog.active.id === parsed.plan.id;
  return json(
    {
      plan_id: parsed.plan.id,
      active: isActive,
      plan: isActive ? catalog.active : parsed.plan,
    },
    saved.created ? 201 : 200,
  );
}
