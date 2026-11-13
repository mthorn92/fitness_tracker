import { createHash } from "node:crypto";

/** Raw PNG body cap for PUT /api/docs/:slug/assets/:path. */
export const MAX_ASSET_BYTES = 5 * 1024 * 1024;

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * Safe relative path: reports/foo-bar_1.png.
 * Each segment starts with a letter or digit. The rest may include ".", "_" and "-".
 * The file must end in lowercase .png. "." and ".." segments are rejected, and so is a leading slash.
 */
const ASSET_PATH = /^(?:[A-Za-z0-9][A-Za-z0-9._-]{0,80}\/)*[A-Za-z0-9][A-Za-z0-9._-]{0,80}\.png$/;

export function normalizeAssetPath(value: string): string | null {
  let path = value.trim();
  const cut = path.search(/[?#]/);
  if (cut !== -1) path = path.slice(0, cut);
  while (path.startsWith("./")) path = path.slice(2);
  if (path.startsWith("/") || path.includes("\\")) return null;
  try {
    path = decodeURIComponent(path);
  } catch {
    return null;
  }
  while (path.startsWith("./")) path = path.slice(2);
  if (path.length < 5 || path.length > 180) return null;
  if (path.includes("\0") || path.startsWith("/") || path.includes("\\")) return null;
  if (path.split("/").some((part) => part === "" || part === "." || part === "..")) return null;
  if (!ASSET_PATH.test(path)) return null;
  return path;
}

export function documentAssetUrl(slug: string, assetPath: string): string {
  const encoded = assetPath.split("/").map((part) => encodeURIComponent(part)).join("/");
  return `/api/docs/${encodeURIComponent(slug)}/assets/${encoded}`;
}

/**
 * Absolute http(s) URLs stay as written. A safe relative path becomes the
 * asset GET URL for this document. Anything else is not rendered.
 */
export function resolveRenderedImageSrc(src: string, slug: string): string | null {
  const value = src.trim();
  if (value === "") return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith("//")) return null;
  const assetPath = normalizeAssetPath(value);
  if (!assetPath) return null;
  return documentAssetUrl(slug, assetPath);
}

export function isPng(bytes: Uint8Array): boolean {
  if (bytes.length < PNG_MAGIC.length) return false;
  for (let i = 0; i < PNG_MAGIC.length; i++) {
    if (bytes[i] !== PNG_MAGIC[i]) return false;
  }
  return true;
}

export function isPngContentType(value: string | null): boolean {
  if (value == null) return false;
  const media = value.split(";")[0]?.trim().toLowerCase() ?? "";
  return media === "image/png";
}

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function readAssetBody(request: Request): Promise<Buffer | "too_large" | "invalid_image"> {
  const contentLength = request.headers.get("content-length");
  const advertised = contentLength == null || contentLength.trim() === "" ? null : Number(contentLength);
  if (advertised != null && (!Number.isFinite(advertised) || advertised < 0)) return "invalid_image";
  if (advertised != null && advertised > MAX_ASSET_BYTES) return "too_large";
  if (!request.body) return Buffer.alloc(0);

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > MAX_ASSET_BYTES) {
      await reader.cancel();
      return "too_large";
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks, total);
}
