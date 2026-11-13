import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("documents migration is additive", async () => {
  const sql = await readFile(new URL("../migrations/006_documents.sql", import.meta.url), "utf8");
  assert.match(sql, /create table if not exists documents/i);
  assert.match(sql, /slug text primary key/i);
  assert.match(sql, /markdown text not null/i);
  assert.match(sql, /version integer not null/i);
  assert.match(sql, /updated_at timestamptz/i);
});

test("a document can be saved and read back", async () => {
  process.env.FITNESS_PGLITE_MEMORY = "1";
  delete process.env.DATABASE_URL;
  const { saveDocument, loadDocument } = await import("./documents");

  const first = await saveDocument({
    slug: "quad-strategy",
    markdown: "# An Australian Growth–Inflation Quad Strategy\n\nHello $XJO.\n",
  });
  assert.equal(first.ok, true);
  if (!first.ok) return;
  assert.equal(first.created, true);
  assert.equal(first.document.version, 1);
  assert.equal(first.document.title, "An Australian Growth–Inflation Quad Strategy");

  const second = await saveDocument({
    slug: "quad-strategy",
    markdown: "# An Australian Growth–Inflation Quad Strategy\n\nUpdated.\n",
  });
  assert.equal(second.ok, true);
  if (!second.ok) return;
  assert.equal(second.created, false);
  assert.equal(second.document.version, 2);
  assert.equal(second.document.title, first.document.title);

  const pinned = await saveDocument({
    slug: "quad-strategy",
    markdown: "# Kept heading\n\nPinned.\n",
    version: 9,
  });
  assert.equal(pinned.ok, true);
  if (!pinned.ok) return;
  assert.equal(pinned.document.version, 9);

  const loaded = await loadDocument("quad-strategy");
  assert.equal(loaded?.markdown.includes("Pinned."), true);
  assert.equal(loaded?.updated_at.includes("T"), true);
  assert.equal(await loadDocument("missing-doc"), null);

  const bad = await saveDocument({ slug: "quad-strategy", markdown: "x", version: 0.15 });
  assert.deepEqual(bad, { ok: false, error: "invalid_version" });
});
