import assert from "node:assert/strict";
import test from "node:test";
import GithubSlugger from "github-slugger";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import {
  bodyTooLarge,
  markdownBody,
  MAX_BODY_BYTES,
  normalizeSlug,
  parseDocumentTitle,
  parseDocumentVersion,
  protectCurrencyDollars,
  titleFromMarkdown,
} from "./doc-text";

test("slug, title and version parsing", () => {
  assert.equal(normalizeSlug("Quad-Strategy"), "quad-strategy");
  assert.equal(normalizeSlug("../etc"), null);
  assert.equal(normalizeSlug("a"), "a");
  assert.equal(titleFromMarkdown("# An Australian Growth–Inflation Quad Strategy\n\nbody", "quad-strategy"), "An Australian Growth–Inflation Quad Strategy");
  assert.equal(markdownBody("# Same\n\nNext", "Same").startsWith("Next"), true);
  assert.equal(markdownBody("# Other\n\nNext", "Same").startsWith("# Other"), true);
  assert.equal(parseDocumentTitle(undefined), undefined);
  assert.equal(parseDocumentTitle("  Paper  "), "Paper");
  assert.equal(parseDocumentTitle(""), null);
  assert.equal(parseDocumentVersion(undefined), undefined);
  assert.equal(parseDocumentVersion(3), 3);
  assert.equal(parseDocumentVersion(0.15), null);
  assert.equal(parseDocumentVersion("2"), 2);
  assert.equal(bodyTooLarge("x", MAX_BODY_BYTES + 1), true);
  assert.equal(bodyTooLarge("hello", null), false);
});

test("currency and tickers stay text, and math stays math", () => {
  const source = [
    "$XJO is the price index; $XJOA is the total-return index.",
    "Ending wealth $176,608 vs $319,944 after A$70k and $10 brokerage.",
    "Inline $\\Delta y_t = y_t - y_{t-2}$ and a product $P(up)$.",
    "",
    "$$",
    "P(Q) = P(\\text{growth up}) \\times P(\\text{inflation up})",
    "$$",
    "",
    "Code stays put: `$XJOA`.",
  ].join("\n");

  const prepared = protectCurrencyDollars(source);
  const counts = countMath(prepared);
  assert.equal(counts.inline, 2);
  assert.equal(counts.block, 1);
  assert.match(prepared, /\\\$XJO/);
  assert.match(prepared, /\\\$176,608/);
  assert.match(prepared, /A\\\$70k/);
  assert.match(prepared, /`\$XJOA`/);
});

test("heading anchors match the paper contents links", () => {
  const slugger = new GithubSlugger();
  const cases: Array<[string, string]> = [
    ["1. Version and changelog", "1-version-and-changelog"],
    ["6. Phase 1 — Data", "6-phase-1--data"],
    ["10b. Phase 4b — Strengthening the growth nowcast", "10b-phase-4b--strengthening-the-growth-nowcast"],
    ["10e. Base effects (\"comps\")", "10e-base-effects-comps"],
    ["12.1 Common strategy scorecard (v0.12)", "121-common-strategy-scorecard-v012"],
    ["12.2 SMSF sector rotation (Phase 5a)", "122-smsf-sector-rotation-phase-5a"],
  ];
  for (const [heading, anchor] of cases) {
    assert.equal(slugger.slug(heading), anchor);
  }
});

function countMath(markdown: string): { inline: number; block: number } {
  const tree = unified().use(remarkParse).use(remarkGfm).use(remarkMath).parse(markdown);
  let inline = 0;
  let block = 0;
  visit(tree, (node) => {
    if (node.type === "inlineMath") inline += 1;
    if (node.type === "math") block += 1;
  });
  return { inline, block };
}
