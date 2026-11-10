import assert from "node:assert/strict";
import test from "node:test";
import { preferredWhoopBurnKcal } from "./whoop-burn";

test("synced cycle burn wins over a stale day_whoop snapshot", () => {
  assert.equal(preferredWhoopBurnKcal(1800, 2200, 1800), 2200);
});

test("a flat override that differs from the snapshot wins", () => {
  assert.equal(preferredWhoopBurnKcal(2500, 2200, 1800), 2500);
});

test("falls back to the stored burn when no cycle is synced", () => {
  assert.equal(preferredWhoopBurnKcal(1800, null, 1800), 1800);
  assert.equal(preferredWhoopBurnKcal(null, null, 1800), 1800);
  assert.equal(preferredWhoopBurnKcal(null, null, null), null);
});
