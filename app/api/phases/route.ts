import { json, requireLogAccess } from "@/lib/auth";
import { parsePhaseWrites, type PhaseWrite } from "@/lib/phase-validate";
import { listStoredPhases, upsertStoredPhase } from "@/lib/store";

export async function GET(request: Request) {
  const access = await requireLogAccess(request);
  if (access instanceof Response) return access;

  const phases = await listStoredPhases();
  return json({ phases });
}

export async function POST(request: Request) {
  const access = await requireLogAccess(request);
  if (access instanceof Response) return access;

  const parsed = parsePhaseWrites(await request.json().catch(() => null));
  if (parsed === "invalid") return json({ error: "invalid_phase" }, 400);

  const saved: PhaseWrite[] = [];
  for (const phase of parsed) {
    await upsertStoredPhase({
      id: phase.id,
      name: phase.name,
      kind: phase.kind,
      start: phase.start,
      end: phase.end,
      goal_weight_kg: phase.goal_weight_kg,
      kcal_target: phase.kcal_target,
      note: phase.note,
    });
    saved.push(phase);
  }

  return json({ upserted: saved.length, phases: saved }, saved.length === 1 ? 200 : 200);
}