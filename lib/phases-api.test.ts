import assert from "node:assert/strict";
import test from "node:test";
import { GET, POST } from "../app/api/phases/route";
import { loadCaloriePhases, storedPhaseToCaloriePhase } from "./phase-store";
import { activePhase, formatDietPhaseStripNote } from "./phases";

process.env.FITNESS_PGLITE_MEMORY = "1";

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/phases", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

test("GET returns phases sorted by start", async () => {
  await post({
    id: "phase2_maint",
    name: "Maintenance",
    kind: "maintenance",
    start: "2026-12-23",
    end: "2027-01-04",
    kcal_target: 2500,
  });
  await post({
    id: "phase1_cut",
    name: "Cut phase",
    kind: "cut",
    start: "2026-11-09",
    end: "2026-12-22",
    goal_weight_kg: 95,
    kcal_target: 2000,
  });

  const response = await GET(new Request("http://localhost/api/phases"));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.phases.length, 2);
  assert.equal(body.phases[0]?.id, "phase1_cut");
  assert.equal(body.phases[1]?.id, "phase2_maint");
});

test("POST upserts by id and loadCaloriePhases prefers database rows", async () => {
  const invalid = await post({ id: "bad", name: "Nope" });
  assert.equal(invalid.status, 400);

  const saved = await post({
    id: "phase1_cut",
    name: "Cut phase",
    kind: "cut",
    start: "2026-11-09",
    end: "2026-12-22",
    goal_weight_kg: 92,
    kcal_target: 2000,
  });
  assert.equal(saved.status, 200);
  const phases = await loadCaloriePhases();
  assert.equal(phases.length, 2);
  assert.equal(activePhase("2026-11-14", phases)?.name, "Cut phase");
  const row = phases.find((phase) => phase.id === "phase1_cut");
  assert.ok(row);
  const note = formatDietPhaseStripNote("2026-11-14", 95, phases);
  assert.equal(note, "Cut phase · until 22/12 · goal 92 kg");
  assert.equal(storedPhaseToCaloriePhase((await saved.json()).phases[0]).goal_weight_kg, 92);
});