import assert from "node:assert/strict";
import { GET, POST } from "../app/api/sessions/route";

const day = "2026-11-18";

function post(body: unknown, headers?: Record<string, string>) {
  return POST(
    new Request("http://localhost/api/sessions", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
  );
}

function get(query = "", headers?: Record<string, string>) {
  return GET(
    new Request(`http://localhost/api/sessions${query}`, {
      headers,
    }),
  );
}

async function main() {
  const badJson = await POST(
    new Request("http://localhost/api/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    }),
  );
  assert.equal(badJson.status, 400);
  assert.equal((await badJson.json()).error, "invalid_json");

  const badDate = await post({ date: "18-11-2026", completed: true });
  assert.equal(badDate.status, 400);
  assert.equal((await badDate.json()).error, "invalid_date");

  const badRpe = await post({ date: day, completed: true, rpe: 11 });
  assert.equal(badRpe.status, 400);
  assert.equal((await badRpe.json()).error, "invalid_rpe");

  const badSets = await post({
    date: day,
    completed: true,
    sets: [{ exercise_key: "box_squat", set: 1, reps: 7, load_kg: 40 }],
  });
  assert.equal(badSets.status, 400);
  assert.equal((await badSets.json()).error, "invalid_sets");

  const badId = await post({
    id: "session_2026-11-16_01",
    date: day,
    completed: false,
  });
  assert.equal(badId.status, 400);
  assert.equal((await badId.json()).error, "invalid_id");

  const badRange = await get("?from=2026-11-16");
  assert.equal(badRange.status, 400);
  assert.equal((await badRange.json()).error, "invalid_range");

  const created = await post({
    date: day,
    plan_id: "plan_2026-11-16",
    plan_day: "wed",
    completed: true,
    rpe: 7,
    feedback: "Last squat set was a grind.",
    sets: [
      { exercise_key: "box_squat", set: 1, reps: 7, load_kg: 40, done: true },
      { exercise_key: "box_squat", set: 2, reps: 7, load_kg: 40, done: true },
      { exercise_key: "box_squat", set: 3, reps: 6, load_kg: 40, done: true },
    ],
  });
  assert.equal(created.status, 201);
  const createdBody = await created.json();
  assert.equal(createdBody.id, `session_${day}_01`);
  assert.equal(createdBody.sets.length, 3);

  const updated = await post({
    id: createdBody.id,
    date: day,
    plan_id: "plan_2026-11-16",
    plan_day: "wed",
    completed: true,
    rpe: 8,
    feedback: "Updated.",
    sets: createdBody.sets,
  });
  assert.equal(updated.status, 200);
  const updatedBody = await updated.json();
  assert.equal(updatedBody.id, createdBody.id);
  assert.equal(updatedBody.rpe, 8);

  const second = await post({ date: day, completed: false, plan_day: "wed" });
  assert.equal(second.status, 201);
  assert.equal((await second.json()).id, `session_${day}_02`);

  const byDate = await get(`?date=${day}`);
  assert.equal(byDate.status, 200);
  const listed = (await byDate.json()).sessions;
  assert.equal(listed.length, 2);
  assert.equal(listed[0].rpe, 8);
  assert.equal(listed[1].completed, false);

  const run = await post({
    id: "session_2026-11-17_01",
    date: "2026-11-17",
    plan_id: "plan_2026-11-16",
    plan_day: "tue",
    completed: true,
    duration_min: 28,
    avg_hr: 138,
  });
  assert.equal(run.status, 201);

  const range = await get("?from=2026-11-17&to=2026-11-18");
  assert.equal(range.status, 200);
  const ranged = (await range.json()).sessions;
  assert.equal(ranged.length, 3);
  assert.equal(ranged[0].date, "2026-11-17");
  assert.equal(ranged[0].duration_min, 28);
  assert.equal(ranged[0].avg_hr, 138);

  process.env.CURSOR_APP_ID = "verify-sessions";
  process.env.LOG_API_TOKEN = "verify-sessions-token";
  const denied = await get(`?date=${day}`);
  assert.equal(denied.status, 401);
  const allowed = await get(`?date=${day}`, { authorization: "Bearer verify-sessions-token" });
  assert.equal(allowed.status, 200);
  const wrong = await get(`?date=${day}`, { authorization: "Bearer wrong-token" });
  assert.equal(wrong.status, 401);

  console.log("sessions ok", { id: createdBody.id, count: listed.length });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
