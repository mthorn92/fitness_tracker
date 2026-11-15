import assert from "node:assert/strict";
import test from "node:test";
import { GET, POST } from "../app/api/plan/route";
import { REPO_PLANS } from "./plan";

process.env.FITNESS_PGLITE_MEMORY = "1";

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

test("GET returns the active plan and both plan ids", async () => {
  const response = await GET(new Request("http://localhost/api/plan"));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.active_plan_id, "plan_2026-11-15");
  assert.deepEqual(body.plan_ids, ["plan_2026-11-15", "plan_2026-11-16"]);
  assert.equal(body.plan.id, "plan_2026-11-15");
  assert.equal(body.plan.slots.length, 4);
});

test("POST rejects a plan without days and can upsert without replacing the active plan", async () => {
  const invalid = await post({ id: "plan_2026-12-01", name: "Nope" });
  assert.equal(invalid.status, 400);

  const source = REPO_PLANS.find((plan) => plan.id === "plan_2026-11-16");
  assert.ok(source);
  const created = await post({ ...source, name: "8-week strength (stored)", active: false });
  assert.ok(created.status === 200 || created.status === 201);
  const saved = await created.json();
  assert.equal(saved.plan_id, "plan_2026-11-16");
  assert.equal(saved.active, false);
  assert.equal(saved.plan.name, "8-week strength (stored)");

  const listed = await GET(new Request("http://localhost/api/plan"));
  const body = await listed.json();
  assert.equal(body.active_plan_id, "plan_2026-11-15");
  assert.equal(body.plan.name, "Cut + strength block 1");
});
