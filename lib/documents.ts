import {
  normalizeMarkdown,
  parseDocumentTitle,
  parseDocumentVersion,
  titleFromMarkdown,
} from "@/lib/doc-text";
import { sql } from "@/lib/db";

export type StoredDocument = {
  slug: string;
  title: string;
  markdown: string;
  version: number;
  updated_at: string;
};

type DocumentRow = {
  slug: string;
  title: string;
  markdown: string;
  version: number | string;
  updated_at: Date | string;
};

export async function loadDocument(slug: string): Promise<StoredDocument | null> {
  const rows = await sql<DocumentRow>(
    "select slug, title, markdown, version, updated_at from documents where slug = $1",
    [slug],
  );
  const row = rows[0];
  return row ? mapRow(row) : null;
}

export async function saveDocument(input: {
  slug: string;
  markdown: string;
  title?: unknown;
  version?: unknown;
}): Promise<
  | { ok: true; created: boolean; document: StoredDocument }
  | { ok: false; error: "invalid_title" | "invalid_version" }
> {
  const markdown = normalizeMarkdown(input.markdown);
  const titleInput = parseDocumentTitle(input.title);
  if (titleInput === null) return { ok: false, error: "invalid_title" };
  const versionInput = parseDocumentVersion(input.version);
  if (versionInput === null) return { ok: false, error: "invalid_version" };

  const existing = await loadDocument(input.slug);
  const title = titleInput ?? existing?.title ?? titleFromMarkdown(markdown, input.slug);
  const version = versionInput ?? (existing ? existing.version + 1 : 1);

  const rows = await sql<DocumentRow>(
    `insert into documents (slug, title, markdown, version)
     values ($1, $2, $3, $4)
     on conflict (slug) do update set
       title = excluded.title,
       markdown = excluded.markdown,
       version = excluded.version,
       updated_at = now()
     returning slug, title, markdown, version, updated_at`,
    [input.slug, title, markdown, version],
  );
  const row = rows[0];
  if (!row) throw new Error("document was not saved");
  return { ok: true, created: existing == null, document: mapRow(row) };
}

function mapRow(row: DocumentRow): StoredDocument {
  const updated = row.updated_at instanceof Date ? row.updated_at : new Date(row.updated_at);
  return {
    slug: row.slug,
    title: row.title,
    markdown: row.markdown,
    version: Number(row.version),
    updated_at: Number.isNaN(updated.getTime()) ? String(row.updated_at) : updated.toISOString(),
  };
}
