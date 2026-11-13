import { json, requireLogAccess } from "@/lib/auth";
import { isPng, isPngContentType, normalizeAssetPath, readAssetBody } from "@/lib/doc-assets";
import { normalizeSlug } from "@/lib/doc-text";
import { loadDocumentAsset, saveDocumentAsset } from "@/lib/document-assets";

type RouteContext = { params: Promise<{ slug: string; path: string[] }> };

const IMAGE_CACHE = "private, no-cache";

export async function GET(request: Request, context: RouteContext) {
  const parsed = await parseAssetRoute(request, context);
  if (parsed instanceof Response) return parsed;

  const asset = await loadDocumentAsset(parsed.slug, parsed.path);
  if (!asset) return json({ error: "not_found" }, 404);

  const etag = `"${asset.sha256}"`;
  const headers = {
    "content-type": "image/png",
    "cache-control": IMAGE_CACHE,
    etag,
    "x-content-type-options": "nosniff",
  };
  if (etagMatches(request.headers.get("if-none-match"), etag)) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(new Uint8Array(asset.bytes), { status: 200, headers });
}

export async function PUT(request: Request, context: RouteContext) {
  const parsed = await parseAssetRoute(request, context);
  if (parsed instanceof Response) return parsed;

  if (!isPngContentType(request.headers.get("content-type"))) {
    return json({ error: "invalid_image" }, 400);
  }

  const body = await readAssetBody(request);
  if (body === "too_large") return json({ error: "body_too_large" }, 413);
  if (body === "invalid_image" || body.length === 0 || !isPng(body)) {
    return json({ error: "invalid_image" }, 400);
  }

  const saved = await saveDocumentAsset({ slug: parsed.slug, path: parsed.path, bytes: body });
  return json(
    { slug: parsed.slug, path: saved.path, sha256: saved.sha256, bytes: saved.bytes },
    saved.created ? 201 : 200,
  );
}

async function parseAssetRoute(
  request: Request,
  context: RouteContext,
): Promise<{ slug: string; path: string } | Response> {
  const access = await requireLogAccess(request);
  if (access instanceof Response) return access;

  const params = await context.params;
  const slug = normalizeSlug(params.slug);
  if (!slug) return json({ error: "invalid_slug" }, 400);

  const path = normalizeAssetPath(params.path.join("/"));
  if (!path) return json({ error: "invalid_path" }, 400);
  return { slug, path };
}

function etagMatches(header: string | null, etag: string): boolean {
  if (!header) return false;
  return header.split(",").some((part) => {
    const value = part.trim();
    return value === etag || value === `W/${etag}`;
  });
}
