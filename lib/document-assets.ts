import { documentAssetUrl, pngDimensions, sha256Hex } from "@/lib/doc-assets";
import { sql } from "@/lib/db";

export type AssetListing = {
  path: string;
  sha256: string;
};

type ListingRow = {
  path: string;
  sha256: string;
};

type AssetRow = ListingRow & {
  bytes: unknown;
};

export async function listDocumentImageSizes(
  slug: string,
): Promise<Record<string, { width: number; height: number }>> {
  const rows = await sql<{ path: string; head: unknown }>(
    "select path, substring(bytes from 1 for 24) as head from document_assets where slug = $1",
    [slug],
  );
  const sizes: Record<string, { width: number; height: number }> = {};
  for (const row of rows) {
    let head: Uint8Array;
    try {
      head = asBytes(row.head);
    } catch {
      continue;
    }
    const size = pngDimensions(head);
    if (!size) continue;
    sizes[row.path] = size;
    sizes[documentAssetUrl(slug, row.path)] = size;
  }
  return sizes;
}

export async function listDocumentAssets(slug: string): Promise<AssetListing[]> {
  const rows = await sql<ListingRow>(
    "select path, sha256 from document_assets where slug = $1 order by path asc",
    [slug],
  );
  return rows.map((row) => ({ path: row.path, sha256: row.sha256 }));
}

export async function loadDocumentAsset(
  slug: string,
  assetPath: string,
): Promise<{ sha256: string; bytes: Buffer } | null> {
  const rows = await sql<AssetRow>(
    "select path, sha256, bytes from document_assets where slug = $1 and path = $2",
    [slug, assetPath],
  );
  const row = rows[0];
  if (!row) return null;
  return { sha256: row.sha256, bytes: asBytes(row.bytes) };
}

export async function saveDocumentAsset(input: {
  slug: string;
  path: string;
  bytes: Buffer;
}): Promise<{ created: boolean; path: string; sha256: string; bytes: number }> {
  const sha256 = sha256Hex(input.bytes);
  const existing = await sql<{ path: string }>(
    "select path from document_assets where slug = $1 and path = $2",
    [input.slug, input.path],
  );
  await sql(
    `insert into document_assets (slug, path, sha256, bytes, content_type)
     values ($1, $2, $3, $4, 'image/png')
     on conflict (slug, path) do update set
       sha256 = excluded.sha256,
       bytes = excluded.bytes,
       content_type = excluded.content_type,
       updated_at = now()`,
    [input.slug, input.path, sha256, input.bytes],
  );
  return {
    created: existing.length === 0,
    path: input.path,
    sha256,
    bytes: input.bytes.length,
  };
}

function asBytes(value: unknown): Buffer {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value === "string") {
    const hex = value.startsWith("\\x") ? value.slice(2) : value;
    return Buffer.from(hex, "hex");
  }
  throw new Error("asset bytes were not returned");
}
