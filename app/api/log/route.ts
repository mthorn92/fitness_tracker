import { json, requireLogAccess } from "@/lib/auth";
import { asDate } from "@/lib/api-body";
import { loadSnapshot } from "@/lib/store";

export async function GET(request: Request) {
  const access = await requireLogAccess(request);
  if (access instanceof Response) return access;

  const snapshot = await loadSnapshot();
  const date = asDate(new URL(request.url).searchParams.get("date") ?? undefined);
  if (!date) {
    return json({ snapshot });
  }
  return json({
    date,
    targets: snapshot.targets,
    day: snapshot.days[date] ?? null,
    saved_meals: snapshot.saved_meals,
  });
}
