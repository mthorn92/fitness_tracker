import assert from "node:assert/strict";
import test from "node:test";
import { isDashboardTab, parseDashboardTab, resolveDashboardTab } from "./dashboard-tab";

test("diet stays the default tab", () => {
  assert.equal(parseDashboardTab(undefined), "diet");
  assert.equal(parseDashboardTab(""), "diet");
  assert.equal(parseDashboardTab("nope"), "diet");
  assert.equal(parseDashboardTab("INVESTING"), "diet");
  assert.equal(parseDashboardTab(["diet", "exercise"]), "diet");
});

test("exercise is explicit", () => {
  assert.equal(parseDashboardTab("exercise"), "exercise");
  assert.equal(parseDashboardTab(["exercise"]), "exercise");
  assert.equal(isDashboardTab("exercise"), true);
  assert.equal(isDashboardTab("investing"), false);
  assert.equal(isDashboardTab("notes"), false);
});

test("an old investing link opens diet even if another tab was saved", () => {
  assert.equal(parseDashboardTab("investing"), "diet");
  assert.equal(parseDashboardTab(["investing"]), "diet");
  assert.equal(resolveDashboardTab("investing", "exercise", "exercise"), "diet");
  assert.equal(resolveDashboardTab("exercise", "investing", "diet"), "exercise");
  assert.equal(resolveDashboardTab(null, "exercise", "diet"), "exercise");
  assert.equal(resolveDashboardTab(null, "investing", "diet"), "diet");
  assert.equal(resolveDashboardTab(undefined, undefined, "diet"), "diet");
});
