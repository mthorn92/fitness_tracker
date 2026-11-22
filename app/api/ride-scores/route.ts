import { json, requireLogAccess } from "@/lib/auth";
import { listRideScores, parseRideScores, realCalendarDay, upsertRideScores } from "@/lib/ride-scores";

export async function GET(request: Request) {
  const access = await requireLogAccess(request);
  if (access instanceof Response) return access;

  const fromRaw = new URL(request.url).searchParams.get("from");
  let from: string | undefined;
  if (fromRaw != null && fromRaw !== "") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fromRaw) || !realCalendarDay(fromRaw)) {
      return json({ error: "invalid_date" }, 400);
    }
    from = fromRaw;
  }

  const rides = await listRideScores(from ? { from } : undefined);
  return json({ from: from ?? null, rides });
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
  const parsed = parseRideScores(body);
  if (!Array.isArray(parsed)) return json(parsed, 400);

  const saved = await upsertRideScores(parsed);
  return json({ upserted: saved.length, rides: saved });
}