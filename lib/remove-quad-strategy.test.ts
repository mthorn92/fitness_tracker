import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const FILE = new URL("../migrations/009_remove_quad_strategy.sql", import.meta.url);

function statements(sqlText: string): string[] {
  return sqlText
    .split(";")
    .map((part) => part.replace(/--[^\n]*/g, "").trim())
    .filter((part) => part.length > 0);
}

test("quad-strategy migration only deletes that paper and its assets", async () => {
  const sqlText = await readFile(FILE, "utf8");
  const commands = statements(sqlText);
  assert.deepEqual(commands, [
    "delete from document_assets where slug = 'quad-strategy'",
    "delete from documents where slug = 'quad-strategy'",
  ]);
  assert.doesNotMatch(sqlText, /drop\s+table/i);
  assert.doesNotMatch(sqlText, /truncate/i);
});

test("deleting quad-strategy is idempotent and leaves other documents", async () => {
  process.env.FITNESS_PGLITE_MEMORY = "1";
  delete process.env.DATABASE_URL;
  const { sql } = await import("./db");
  const commands = statements(await readFile(FILE, "utf8"));

  await sql("delete from document_assets where slug in ('quad-strategy', 'keep-note')");
  await sql("delete from documents where slug in ('quad-strategy', 'keep-note')");
  await sql(
    `insert into documents (slug, title, markdown, version)
     values ($1, $2, $3, $4), ($5, $6, $7, $8)`,
    [
      "quad-strategy",
      "An Australian Growth–Inflation Quad Strategy",
      "# An Australian Growth–Inflation Quad Strategy\n\nbody",
      4,
      "keep-note",
      "Keep",
      "still here",
      1,
    ],
  );
  await sql(
    `insert into document_assets (slug, path, sha256, bytes, content_type)
     values ($1, $2, $3, $4, 'image/png'), ($5, $6, $7, $8, 'image/png')`,
    [
      "quad-strategy",
      "reports/quad-fig.png",
      "a".repeat(64),
      Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      "keep-note",
      "reports/keep.png",
      "b".repeat(64),
      Buffer.from([1]),
    ],
  );

  for (let pass = 0; pass < 2; pass++) {
    for (const command of commands) await sql(command);
  }

  const docs = await sql<{ slug: string }>("select slug from documents order by slug");
  assert.deepEqual(
    docs.map((row) => row.slug),
    ["keep-note"],
  );
  const assets = await sql<{ slug: string; path: string }>(
    "select slug, path from document_assets order by slug, path",
  );
  assert.deepEqual(assets, [{ slug: "keep-note", path: "reports/keep.png" }]);

  await sql("delete from document_assets where slug = 'keep-note'");
  await sql("delete from documents where slug = 'keep-note'");
});
