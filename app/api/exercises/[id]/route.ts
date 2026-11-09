import { json, requireLogAccess } from "@/lib/auth";
import { deleteExercise } from "@/lib/store";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireLogAccess(request);
  if (access instanceof Response) return access;
  const { id } = await params;
  const deleted = await deleteExercise(id);
  if (!deleted) return json({ error: "not_found" }, 404);
  return json({ ok: true });
}
