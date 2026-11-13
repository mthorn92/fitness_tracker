#!/usr/bin/env node
// Upload one local markdown file to a document slug.
//
// Usage:
//   node scripts/push-doc.mjs <slug> <file.md>
//
// Environment (never printed):
//   DOCS_BASE_URL or APP_URL   site origin. Default: https://training-log.apps.grok.bot
//   CURSOR_API_KEY             x-cursor-app-token, required on the published app
//   LOG_API_TOKEN              Authorization bearer, required on the published app
//   DOC_TITLE                  optional title
//   DOC_VERSION                optional whole number (1 or more)
//
// Localhost does not need the tokens. The script still sends them when they are set.

import { readFile } from "node:fs/promises";

const slug = process.argv[2];
const file = process.argv[3];
if (!slug || !file || process.argv.length !== 4) {
  console.error("usage: node scripts/push-doc.mjs <slug> <file.md>");
  process.exit(1);
}

const base = (process.env.DOCS_BASE_URL || process.env.APP_URL || "https://training-log.apps.grok.bot").replace(
  /\/$/,
  "",
);
let hostname = "";
try {
  hostname = new URL(base).hostname;
} catch {
  console.error("DOCS_BASE_URL is not a valid URL");
  process.exit(1);
}

const local = hostname === "localhost" || hostname === "127.0.0.1";
const appToken = process.env.CURSOR_API_KEY ?? "";
const logToken = process.env.LOG_API_TOKEN ?? "";
if (!local && (appToken === "" || logToken === "")) {
  console.error("Set CURSOR_API_KEY and LOG_API_TOKEN. They are not printed.");
  process.exit(1);
}

let markdown;
try {
  markdown = await readFile(file, "utf8");
} catch {
  console.error("Could not read the markdown file.");
  process.exit(1);
}

const body = { markdown };
if (process.env.DOC_TITLE) body.title = process.env.DOC_TITLE;
if (process.env.DOC_VERSION != null && process.env.DOC_VERSION !== "") {
  if (!/^[1-9]\d*$/.test(process.env.DOC_VERSION)) {
    console.error("DOC_VERSION must be a whole number, 1 or more.");
    process.exit(1);
  }
  body.version = Number(process.env.DOC_VERSION);
}

const headers = { "content-type": "application/json" };
if (logToken !== "") headers.authorization = `Bearer ${logToken}`;
if (appToken !== "") headers["x-cursor-app-token"] = appToken;

let response;
try {
  response = await fetch(`${base}/api/docs/${encodeURIComponent(slug)}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(body),
  });
} catch {
  console.error("upload failed: could not reach the site");
  process.exit(1);
}

let payload = null;
const text = await response.text();
try {
  payload = JSON.parse(text);
} catch {
  payload = null;
}

const errorCode = payload && typeof payload.error === "string" ? payload.error : "not_json";
if (!response.ok || payload == null || typeof payload.version !== "number" || typeof payload.updated_at !== "string") {
  console.error(`upload failed (${response.status} ${errorCode})`);
  process.exit(1);
}

console.log(JSON.stringify({ slug: payload.slug, version: payload.version, updated_at: payload.updated_at }));
