import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MarkdownDocument } from "../components/MarkdownDocument";
import { documentAssetUrl, MAX_ASSET_BYTES, normalizeAssetPath, resolveRenderedImageSrc, sha256Hex } from "./doc-assets";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test("document asset migration is additive", async () => {
  const sql = await readFile(new URL("../migrations/007_document_assets.sql", import.meta.url), "utf8");
  assert.match(sql, /create table if not exists document_assets/i);
  assert.match(sql, /sha256 text not null/i);
  assert.match(sql, /bytes bytea not null/i);
  assert.match(sql, /primary key \(slug, path\)/i);
  assert.doesNotMatch(sql, /alter table documents/i);
});

test("asset paths stay inside reports-style names", () => {
  assert.equal(normalizeAssetPath("reports/foo-bar_1.png"), "reports/foo-bar_1.png");
  assert.equal(normalizeAssetPath("./reports/foo-bar_1.png"), "reports/foo-bar_1.png");
  assert.equal(normalizeAssetPath("reports/chart.v2.png"), "reports/chart.v2.png");
  assert.equal(normalizeAssetPath("reports/foo-bar_1.png?x=1"), "reports/foo-bar_1.png");
  for (const bad of [
    "../secret.png",
    "reports/../../secret.png",
    "/reports/foo.png",
    "reports/foo.jpg",
    "reports/foo.PNG",
    "reports/foo.png.exe",
    "reports/foo bar.png",
    "reports//foo.png",
    "reports/./foo.png",
    "..",
    "reports/foo.png/..",
    "",
    "javascript:alert(1)",
  ]) {
    assert.equal(normalizeAssetPath(bad), null, bad);
  }

  assert.equal(
    resolveRenderedImageSrc("reports/foo-bar_1.png", "quad-strategy"),
    "/api/docs/quad-strategy/assets/reports/foo-bar_1.png",
  );
  assert.equal(
    resolveRenderedImageSrc("https://example.com/a.png", "quad-strategy"),
    "https://example.com/a.png",
  );
  assert.equal(resolveRenderedImageSrc("http://example.com/a.png", "quad-strategy"), "http://example.com/a.png");
  assert.equal(resolveRenderedImageSrc("//example.com/a.png", "quad-strategy"), null);
  assert.equal(resolveRenderedImageSrc("../secret.png", "quad-strategy"), null);
  assert.equal(documentAssetUrl("quad-strategy", "reports/foo-bar_1.png"), "/api/docs/quad-strategy/assets/reports/foo-bar_1.png");
});

test("paper html keeps figures and rewrites relative images", () => {
  const html = renderToStaticMarkup(
    createElement(MarkdownDocument, {
      slug: "quad-strategy",
      markdown: [
        "The nowcast turned up.",
        "",
        '<figure><img src="reports/foo-bar_1.png" alt="Growth nowcast"><figcaption>Four-quarter change.</figcaption></figure>',
        "",
        '<img src="https://example.com/remote.png" alt="Remote">',
        '<img src="javascript:alert(1)" alt="Bad">',
        '<img src="../secret.png" alt="Escape">',
        "",
        "![Chart](reports/other_2.png)",
      ].join("\n"),
    }),
  );
  assert.match(html, /<figure>/);
  assert.match(html, /<figcaption>Four-quarter change\.<\/figcaption>/);
  assert.match(html, /src="\/api\/docs\/quad-strategy\/assets\/reports\/foo-bar_1.png"/);
  assert.match(html, /src="\/api\/docs\/quad-strategy\/assets\/reports\/other_2.png"/);
  assert.match(html, /src="https:\/\/example.com\/remote.png"/);
  assert.match(html, /class="doc-image"/);
  assert.doesNotMatch(html, /javascript:/);
  assert.doesNotMatch(html, /secret\.png/);
});

test("asset endpoints require auth, reject bad paths, and list sha256", async () => {
  process.env.FITNESS_PGLITE_MEMORY = "1";
  delete process.env.DATABASE_URL;
  process.env.VERCEL = "1";
  process.env.LOG_API_TOKEN = "asset-test-token";
  delete process.env.CURSOR_APP_ID;

  const { GET: listAssets } = await import("../app/api/docs/[slug]/assets/route");
  const { GET: readAsset, PUT } = await import("../app/api/docs/[slug]/assets/[...path]/route");
  const slug = "quad-strategy";
  const token = "asset-test-token";

  const list = (auth: boolean, rawSlug = slug) =>
    listAssets(new Request(`http://localhost/api/docs/${rawSlug}/assets`, { headers: auth ? authHeader(token) : {} }), {
      params: Promise.resolve({ slug: rawSlug }),
    });
  const read = (assetPath: string, headers?: HeadersInit) =>
    readAsset(new Request(`http://localhost/api/docs/${slug}/assets/${assetPath}`, { headers }), {
      params: Promise.resolve({ slug, path: assetPath.split("/") }),
    });
  const put = (assetPath: string, body: Uint8Array, headers: Record<string, string>) =>
    PUT(
      new Request("http://localhost/api/docs/asset", {
        method: "PUT",
        headers,
        body: new Blob([body]),
      }),
      { params: Promise.resolve({ slug, path: assetPath.split("/") }) },
    );

  const noAuth = await put("reports/foo-bar_1.png", PNG, { "content-type": "image/png" });
  assert.equal(noAuth.status, 401);
  assert.equal((await noAuth.json()).error, "unauthorized");
  assert.equal((await list(false)).status, 401);
  assert.equal((await read("reports/foo-bar_1.png")).status, 401);
  const wrong = await put("reports/foo-bar_1.png", PNG, {
    "content-type": "image/png",
    authorization: "Bearer wrong-token",
  });
  assert.equal(wrong.status, 401);

  const authed = { "content-type": "image/png", authorization: `Bearer ${token}` };
  for (const bad of ["../secret.png", "reports/../../secret.png", "reports/foo.jpg", "reports/foo bar.png", "foo.PNG"]) {
    const response = await put(bad, PNG, authed);
    assert.equal(response.status, 400, bad);
    assert.equal((await response.json()).error, "invalid_path");
  }

  const badSlug = await PUT(
    new Request("http://localhost/api/docs/nope/assets/reports/foo.png", {
      method: "PUT",
      headers: authed,
      body: PNG,
    }),
    { params: Promise.resolve({ slug: "../etc", path: ["reports", "foo.png"] }) },
  );
  assert.equal(badSlug.status, 400);
  assert.equal((await badSlug.json()).error, "invalid_slug");

  const notPng = await put("reports/foo-bar_1.png", Buffer.from("not a png"), authed);
  assert.equal(notPng.status, 400);
  assert.equal((await notPng.json()).error, "invalid_image");
  const jpegType = await put("reports/foo-bar_1.png", PNG, { ...authed, "content-type": "image/jpeg" });
  assert.equal(jpegType.status, 400);

  const emptyList = await list(true, "empty-slug");
  assert.equal(emptyList.status, 200);
  assert.deepEqual(await emptyList.json(), []);

  const created = await put("reports/foo-bar_1.png", PNG, authed);
  assert.equal(created.status, 201);
  const createdBody = await created.json();
  assert.equal(createdBody.slug, slug);
  assert.equal(createdBody.path, "reports/foo-bar_1.png");
  assert.equal(createdBody.sha256, sha256Hex(PNG));
  assert.equal(createdBody.sha256, createHash("sha256").update(PNG).digest("hex"));
  assert.equal(createdBody.bytes, PNG.length);

  const other = Buffer.from(PNG);
  other[other.length - 1] ^= 0xff;
  const second = await put("reports/other_2.png", other, { ...authed, "content-type": "image/png; charset=binary" });
  assert.equal(second.status, 201);

  const listed = await list(true);
  assert.equal(listed.status, 200);
  assert.deepEqual(await listed.json(), [
    { path: "reports/foo-bar_1.png", sha256: sha256Hex(PNG) },
    { path: "reports/other_2.png", sha256: sha256Hex(other) },
  ]);

  const replaced = await put("reports/foo-bar_1.png", other, authed);
  assert.equal(replaced.status, 200);
  assert.equal((await replaced.json()).sha256, sha256Hex(other));
  const after = (await (await list(true)).json()) as Array<{ path: string; sha256: string }>;
  assert.equal(after.find((row) => row.path === "reports/foo-bar_1.png")?.sha256, sha256Hex(other));

  const image = await read("reports/other_2.png", { authorization: `Bearer ${token}` });
  assert.equal(image.status, 200);
  assert.equal(image.headers.get("content-type"), "image/png");
  assert.equal(image.headers.get("cache-control"), "private, no-cache");
  assert.equal(image.headers.get("etag"), `"${sha256Hex(other)}"`);
  assert.deepEqual(Buffer.from(await image.arrayBuffer()), other);

  const cached = await read("reports/other_2.png", {
    authorization: `Bearer ${token}`,
    "if-none-match": `"${sha256Hex(other)}"`,
  });
  assert.equal(cached.status, 304);

  const missing = await read("reports/missing.png", { authorization: `Bearer ${token}` });
  assert.equal(missing.status, 404);
  assert.equal((await missing.json()).error, "not_found");

  const tooBig = await put("reports/big.png", Buffer.alloc(MAX_ASSET_BYTES + 1, 1), authed);
  assert.equal(tooBig.status, 413);
  assert.equal((await tooBig.json()).error, "body_too_large");

  delete process.env.VERCEL;
  delete process.env.CURSOR_APP_ID;
  const pageView = await read("reports/other_2.png");
  assert.equal(pageView.status, 200);
  assert.equal(pageView.headers.get("content-type"), "image/png");
});

function authHeader(token: string): HeadersInit {
  return { authorization: `Bearer ${token}` };
}
