import assert from "node:assert/strict";
import test from "node:test";
import { isDashboardTab, parseDashboardTab } from "./dashboard-tab";

test("diet stays the default tab", () => {
  assert.equal(parseDashboardTab(undefined), "diet");
  assert.equal(parseDashboardTab(""), "diet");
  assert.equal(parseDashboardTab("nope"), "diet");
  assert.equal(parseDashboardTab("INVESTING"), "diet");
  assert.equal(parseDashboardTab(["diet", "exercise"]), "diet");
});

test("exercise and investing are explicit", () => {
  assert.equal(parseDashboardTab("exercise"), "exercise");
  assert.equal(parseDashboardTab("investing"), "investing");
  assert.equal(parseDashboardTab(["investing"]), "investing");
  assert.equal(isDashboardTab("investing"), true);
  assert.equal(isDashboardTab("notes"), false);
});
