import { mkdir, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";

type GlobalDb = {
  __fitnessPool?: pg.Pool;
  __fitnessPglite?: Promise<PGlite>;
};

const globalForDb = globalThis as typeof globalThis & GlobalDb;
const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";

export async function sql<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  if (databaseUrl !== "") {
    globalForDb.__fitnessPool ??= new pg.Pool({ connectionString: databaseUrl, max: 5 });
    return (await globalForDb.__fitnessPool.query(text, params)).rows as T[];
  }
  globalForDb.__fitnessPglite ??= startLocal().catch((error: unknown) => {
    globalForDb.__fitnessPglite = undefined;
    throw error;
  });
  return (await (await globalForDb.__fitnessPglite).query<T>(text, params)).rows;
}

async function startLocal(): Promise<PGlite> {
  const memory = process.env.FITNESS_PGLITE_MEMORY === "1";
  const dataDir = memory ? undefined : path.join(process.cwd(), ".data", "pglite");
  if (dataDir) {
    await mkdir(path.dirname(dataDir), { recursive: true });
  }
  const db = new PGlite(dataDir);
  const dir = path.join(process.cwd(), "migrations");
  const files = (await readdir(dir).catch(() => []))
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const file of files) {
    await db.exec(await readFile(path.join(dir, file), "utf8"));
  }
  return db;
}
