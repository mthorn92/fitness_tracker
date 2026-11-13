import { asObject } from "@/lib/api-body";
import { json, requireLogAccess } from "@/lib/auth";
import { bodyTooLarge, MAX_MARKDOWN_CHARS, normalizeSlug } from "@/lib/doc-text";
import { loadDocument, saveDocument } from "@/lib/documents";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(request: Request, context: RouteContext) {
  const access = await requireLogAccess(request);
  if (access instanceof Response) return access;

  const slug = normalizeSlug((await context.params).slug);
  if (!slug) return json({ error: "invalid_slug" }, 400);

  const document = await loadDocument(slug);
  if (!document) return json({ error: "not_found" }, 404);
  return json(document);
}

export async function PUT(request: Request, context: RouteContext) {
  return writeDocument(request, context);
}

export async function POST(request: Request, context: RouteContext) {
  return writeDocument(request, context);
}

async function writeDocument(request: Request, context: RouteContext) {
  const access = await requireLogAccess(request);
  if (access instanceof Response) return access;

  const slug = normalizeSlug((await context.params).slug);
  if (!slug) return json({ error: "invalid_slug" }, 400);

  const contentLength = request.headers.get("content-length");
  const advertised = contentLength == null || contentLength.trim() === "" ? null : Number(contentLength);
  if (advertised != null && (!Number.isFinite(advertised) || advertised < 0)) {
    return json({ error: "invalid_json" }, 400);
  }
  if (advertised != null && bodyTooLarge("", advertised)) {
    return json({ error: "body_too_large" }, 413);
  }

  const raw = await request.text();
  if (bodyTooLarge(raw, advertised)) return json({ error: "body_too_large" }, 413);

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const body = asObject(parsed);
  if (!body) return json({ error: "invalid_json" }, 400);
  if (typeof body.markdown !== "string") return json({ error: "invalid_markdown" }, 400);
  if (body.markdown.trim().length === 0) return json({ error: "invalid_markdown" }, 400);
  if (body.markdown.length > MAX_MARKDOWN_CHARS) return json({ error: "body_too_large" }, 413);

  const saved = await saveDocument({
    slug,
    markdown: body.markdown,
    title: "title" in body ? body.title : undefined,
    version: "version" in body ? body.version : undefined,
  });
  if (!saved.ok) return json({ error: saved.error }, 400);

  const { slug: storedSlug, title, version, updated_at } = saved.document;
  return json({ slug: storedSlug, title, version, updated_at }, saved.created ? 201 : 200);
}
