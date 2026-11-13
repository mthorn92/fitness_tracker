import { asDate } from "@/lib/api-body";
import { json, requireLogAccess } from "@/lib/auth";
import { lastSyncedAt, listWorkouts, parseActivities, upsertWorkouts } from "@/lib/workouts";

export async function GET(request: Request) {
  const access = await requireLogAccess(request);
  if (access instanceof Response) return access;

  const params = new URL(request.url).searchParams;
  const fromRaw = params.get("from");
  const toRaw = params.get("to");
  const hasFrom = fromRaw != null && fromRaw !== "";
  const hasTo = toRaw != null && toRaw !== "";
  if (hasFrom !== hasTo) {
    return json({ error: "invalid_range", message: "from and to are both required." }, 400);
  }

  let range: { from: string; to: string } | undefined;
  if (hasFrom || hasTo) {
    const from = asDate(fromRaw ?? undefined);
    const to = asDate(toRaw ?? undefined);
    if (!from || !to) return json({ error: "invalid_date" }, 400);
    if (from > to) return json({ error: "invalid_range", message: "from is after to." }, 400);
    range = { from, to };
  }

  const [activities, synced] = await Promise.all([listWorkouts(range), lastSyncedAt()]);
  return json({
    from: range?.from ?? null,
    to: range?.to ?? null,
    last_synced_at: synced,
    activities,
  });
}

export async function POST(request: Request) {
  const access = await requireLogAccess(request);
  if (access instanceof Response) return access;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const activities = parseActivities(body);
  if (!Array.isArray(activities)) return json(activities, 400);

  const saved = await upsertWorkouts(activities);
  const synced = await lastSyncedAt();
  return json({
    upserted: saved.length,
    last_synced_at: synced,
    activities: saved,
  });
}
