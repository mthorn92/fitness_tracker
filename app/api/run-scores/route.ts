import { json, requireLogAccess } from "@/lib/auth";
import { listRunScores, parseRunScores, realCalendarDay, upsertRunScores } from "@/lib/run-scores";

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

  const runs = await listRunScores(from ? { from } : undefined);
  return json({ from: from ?? null, runs });
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
  const parsed = parseRunScores(body);
  if (!Array.isArray(parsed)) return json(parsed, 400);

  const saved = await upsertRunScores(parsed);
  return json({ upserted: saved.length, runs: saved });
}
