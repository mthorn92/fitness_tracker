import assert from "node:assert/strict";
import test from "node:test";
import { formatChartHoverValue } from "./chart-tooltip";

test("kcal hover values are whole numbers with thousands separators", () => {
  assert.equal(formatChartHoverValue(2640.4, "kcal"), "2,640");
  assert.equal(formatChartHoverValue(1234.6, "kcal"), "1,235");
  assert.equal(formatChartHoverValue(-980.2, "kcal"), "-980");
});

test("kg, g, and L hover values keep one decimal place", () => {
  assert.equal(formatChartHoverValue(98.04, "kg"), "98.0");
  assert.equal(formatChartHoverValue(160, "g"), "160.0");
  assert.equal(formatChartHoverValue(3, "L"), "3.0");
  assert.equal(formatChartHoverValue(1.26, "kg"), "1.3");
});
