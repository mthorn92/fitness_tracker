import { json, requireLogAccess } from "@/lib/auth";
import { normalizeSlug } from "@/lib/doc-text";
import { listDocumentAssets } from "@/lib/document-assets";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(request: Request, context: RouteContext) {
  const access = await requireLogAccess(request);
  if (access instanceof Response) return access;

  const slug = normalizeSlug((await context.params).slug);
  if (!slug) return json({ error: "invalid_slug" }, 400);

  return json(await listDocumentAssets(slug));
}
