import { PHASES, type CaloriePhase } from "@/lib/phases";
import { ensureStore, listStoredPhases, type StoredPhaseRow } from "@/lib/store";

export type { StoredPhaseRow };

export function storedPhaseToCaloriePhase(row: StoredPhaseRow): CaloriePhase {
  return {
    id: row.id,
    name: row.name,
    start: row.start,
    end: row.end ?? "",
    kcal_target: row.kcal_target ?? PHASES[0]?.kcal_target ?? 2000,
    subtitle: row.kind ?? undefined,
    goal_weight_kg: row.goal_weight_kg,
    note: row.note,
  };
}

/** DB rows when the table has any phase; otherwise the repo default PHASES constant. */
export async function loadCaloriePhases(): Promise<readonly CaloriePhase[]> {
  await ensureStore();
  const rows = await listStoredPhases();
  if (rows.length === 0) return PHASES;
  return rows.map(storedPhaseToCaloriePhase);
}
