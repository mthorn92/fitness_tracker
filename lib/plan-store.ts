import { REPO_ACTIVE_PLAN_ID, REPO_PLANS, loadRepoTrainingPlan } from "@/lib/plan";
import { parsePlan } from "@/lib/plan-validate";
import { listStoredPlans, upsertStoredPlan } from "@/lib/store";
import type { TrainingPlan } from "@/lib/types";

export type PlanCatalog = {
  active: TrainingPlan;
  ids: string[];
};

/**
 * Stored plans replace the repo JSON with the same id.
 * Missing ids are seeded from the repo so a fresh database still has both blocks.
 */
export async function loadPlanCatalog(): Promise<PlanCatalog> {
  await seedMissingRepoPlans();
  const stored = await listStoredPlans();
  const byId = new Map<string, TrainingPlan>();
  for (const plan of REPO_PLANS) byId.set(plan.id, plan);

  let activeId: string | null = null;
  for (const row of stored) {
    const parsed = parsePlan(row.body);
    if ("error" in parsed) continue;
    byId.set(parsed.id, parsed);
    if (row.active) activeId = parsed.id;
  }

  if (!activeId || !byId.has(activeId)) activeId = REPO_ACTIVE_PLAN_ID;
  const active = byId.get(activeId) ?? loadRepoTrainingPlan();
  return { active, ids: [...byId.keys()].sort() };
}

export async function loadActiveTrainingPlan(): Promise<TrainingPlan> {
  const catalog = await loadPlanCatalog();
  return catalog.active;
}

async function seedMissingRepoPlans(): Promise<void> {
  const stored = await listStoredPlans();
  const have = new Set(stored.map((row) => row.id));
  const anyActive = stored.some((row) => row.active && !("error" in parsePlan(row.body)));
  for (const plan of REPO_PLANS) {
    if (have.has(plan.id)) continue;
    const active = !anyActive && plan.id === REPO_ACTIVE_PLAN_ID;
    await upsertStoredPlan(plan.id, plan, active, { refresh: false });
  }
}
