import { json, requireLogAccess } from "@/lib/auth";

export async function GET(request: Request) {
  const access = await requireLogAccess(request);
  if (access instanceof Response) return access;

  return json({
    openapi: "3.1.0",
    info: {
      title: "Training log",
      version: "1.4.0",
      description:
        "Personal food, water, weight, exercise, WHOOP and saved-meal log. The Grok Bot writes here; the website only displays it. Always send a stable id so a correction updates the same row. Saved meals upsert by name. Optional flat day fields whoop_burn_kcal, cycle_closed, strain, recovery_pct are additive aliases. Strength and run sessions are a separate additive API at /api/sessions and do not change /api/log or the food budget.",
    },
    security: [{ cursorAppToken: [], bearerAuth: [] }],
    components: {
      securitySchemes: {
        cursorAppToken: {
          type: "apiKey",
          in: "header",
          name: "x-cursor-app-token",
          description:
            "Cursor API key. Required on the live private app so the host does not return the sign-in page.",
        },
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          description: "LOG_API_TOKEN. What /api routes check after the host lets the request through.",
        },
      },
      schemas: {
        Food: {
          type: "object",
          required: ["id", "time", "item"],
          properties: {
            id: { type: "string", example: "food_2026-11-09_yogurt" },
            time: { type: "string", example: "08:15" },
            item: { type: "string", example: "Greek yogurt" },
            meal: {
              type: "string",
              description: "Meal bucket shown in the day UI (e.g. Breakfast, Lunch, Dinner, Snacks, Dessert)",
              example: "Breakfast",
            },
            kcal: { type: "number", example: 150 },
            protein_g: { type: "number", example: 20 },
            carbs_g: { type: "number", example: 8 },
            fat_g: { type: "number", example: 4 },
            saved_meal: {
              type: "string",
              description: "Optional saved-meal name; macros fill in when omitted",
              example: "chicken rice veg meal prep",
            },
          },
        },
        Water: {
          type: "object",
          required: ["id", "time", "item", "litres"],
          properties: {
            id: { type: "string" },
            time: { type: "string", example: "09:00" },
            item: { type: "string", example: "Water" },
            litres: { type: "number", example: 0.5 },
            estimated: { type: "boolean" },
          },
        },
        Exercise: {
          type: "object",
          required: ["id", "item"],
          properties: {
            id: { type: "string", example: "ex_2026-11-09_run" },
            item: { type: "string", example: "Easy run" },
            time: { type: "string", example: "17:30" },
            duration_min: { type: "number", example: 35 },
            kcal: { type: "number", example: 320 },
            strain: { type: "number", example: 8.4 },
            avg_hr: { type: "number", example: 142 },
            source: { type: "string", example: "whoop" },
            whoop_id: { type: "string" },
          },
        },
        SavedMeal: {
          type: "object",
          required: ["name", "kcal"],
          properties: {
            name: { type: "string", example: "chicken rice veg meal prep" },
            kcal: { type: "number", example: 380 },
            protein_g: { type: "number", example: 38 },
            carbs_g: { type: "number", example: 41 },
            fat_g: { type: "number", example: 6 },
            serve: { type: "string", example: "1 of 8" },
            recipe: { type: "string" },
          },
        },
        DayWhoop: {
          type: "object",
          required: [
            "recovery_score",
            "hrv_rmssd_milli",
            "resting_heart_rate",
            "sleep_hours",
            "strain",
            "kcal",
          ],
          properties: {
            cycle_id: { type: "number" },
            recovery_score: { type: "number", description: "Recovery %", example: 37 },
            hrv_rmssd_milli: { type: "number", description: "HRV", example: 57.2 },
            resting_heart_rate: { type: "number", example: 66 },
            sleep_hours: { type: "number", example: 7.7 },
            strain: { type: "number", example: 0.86 },
            kcal: { type: "number", description: "Burn kcal", example: 1372 },
            step_count: { type: "number" },
          },
        },
        LogPostBody: {
          type: "object",
          required: ["date"],
          properties: {
            date: { type: "string", example: "2026-11-09" },
            complete: {
              type: "boolean",
              description: "Day-level complete flag",
              example: true,
            },
            cycle_closed: {
              type: "boolean",
              description: "Optional: WHOOP cycle closed for this waking date (deficit charts)",
              example: true,
            },
            whoop_burn_kcal: {
              type: "number",
              description: "Optional flat alias for day WHOOP burn kcal (writes day_whoop.kcal)",
              example: 2219,
            },
            strain: {
              type: "number",
              description: "Optional flat day-level WHOOP strain (writes day_whoop.strain)",
              example: 12.4,
            },
            recovery_pct: {
              type: "number",
              description: "Optional flat recovery % (writes day_whoop.recovery_score)",
              example: 64,
            },
            notes: { type: "string", nullable: true },
            weight_kg: { type: "number" },
            foods: { type: "array", items: { $ref: "#/components/schemas/Food" } },
            water: { type: "array", items: { $ref: "#/components/schemas/Water" } },
            exercises: { type: "array", items: { $ref: "#/components/schemas/Exercise" } },
            saved_meals: {
              type: "array",
              description: "Upserted by name",
              items: { $ref: "#/components/schemas/SavedMeal" },
            },
            whoop: { $ref: "#/components/schemas/DayWhoop" },
            delete: {
              type: "object",
              properties: {
                foods: { type: "array", items: { type: "string" } },
                water: { type: "array", items: { type: "string" } },
                exercises: { type: "array", items: { type: "string" } },
              },
            },
          },
        },
        SessionSet: {
          type: "object",
          required: ["exercise_key", "set", "done"],
          properties: {
            exercise_key: { type: "string", example: "bench_press" },
            set: { type: "integer", minimum: 1, example: 1 },
            reps: { type: "number", nullable: true, example: 7 },
            load_kg: { type: "number", nullable: true, example: 50 },
            band: { type: "string", nullable: true, example: "2 red" },
            hold_s: { type: "number", nullable: true, example: 5 },
            done: { type: "boolean", example: true },
          },
        },
        Session: {
          type: "object",
          required: ["date", "completed"],
          properties: {
            id: {
              type: "string",
              description: "Stable id session_YYYY-MM-DD_NN. Omitted on create; sending it again updates that row.",
              example: "session_2026-11-16_01",
            },
            date: { type: "string", example: "2026-11-16" },
            plan_id: { type: "string", nullable: true, example: "plan_2026-11-16" },
            plan_day: {
              type: "string",
              nullable: true,
              enum: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
              example: "mon",
            },
            completed: { type: "boolean", example: true },
            rpe: { type: "number", nullable: true, minimum: 1, maximum: 10, example: 7 },
            feedback: { type: "string", nullable: true },
            sets: { type: "array", items: { $ref: "#/components/schemas/SessionSet" } },
            duration_min: { type: "number", nullable: true, description: "Run duration in minutes", example: 28 },
            avg_hr: { type: "number", nullable: true, description: "Average heart rate for a run", example: 138 },
          },
        },
        WorkoutActivity: {
          type: "object",
          required: [
            "strava_id",
            "start_time",
            "type",
            "sport_type",
            "name",
            "distance_m",
            "moving_time_s",
            "elapsed_time_s",
          ],
          properties: {
            strava_id: { type: "integer", minimum: 1, example: 12345678901 },
            start_time: {
              type: "string",
              description: "ISO-8601 with a timezone offset, for example 2026-11-12T06:30:00+11:00",
              example: "2026-11-12T06:30:00+11:00",
            },
            type: { type: "string", example: "Run" },
            sport_type: { type: "string", example: "Run" },
            name: { type: "string", example: "Easy run" },
            distance_m: { type: "number", minimum: 0, example: 6100 },
            moving_time_s: { type: "integer", minimum: 0, example: 1920 },
            elapsed_time_s: { type: "integer", minimum: 0, example: 2000 },
            avg_hr: { type: "number", nullable: true, example: 151 },
            max_hr: { type: "number", nullable: true, example: 168 },
            kcal: { type: "number", nullable: true, example: 310 },
            elevation_m: { type: "number", nullable: true, example: 42 },
          },
        },
      },
    },
    paths: {
      "/api/log": {
        get: {
          summary: "Read a day (or the full snapshot if date is omitted)",
          parameters: [
            {
              name: "date",
              in: "query",
              schema: { type: "string", example: "2026-11-09" },
            },
          ],
        },
        post: {
          summary: "Log or correct entries for one date in a single call",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/LogPostBody" },
                example: {
                  date: "2026-11-09",
                  complete: true,
                  foods: [
                    {
                      id: "food_2026-11-09_yogurt",
                      time: "08:15",
                      item: "Greek yogurt",
                      meal: "Breakfast",
                      kcal: 150,
                      protein_g: 20,
                      carbs_g: 8,
                      fat_g: 4,
                    },
                  ],
                  exercises: [
                    {
                      id: "ex_2026-11-09_run",
                      item: "Easy run",
                      time: "17:30",
                      duration_min: 35,
                      kcal: 320,
                      strain: 8.4,
                      avg_hr: 142,
                      source: "whoop",
                    },
                  ],
                  saved_meals: [
                    {
                      name: "chicken rice veg meal prep",
                      kcal: 380,
                      protein_g: 38,
                      carbs_g: 41,
                      fat_g: 6,
                      serve: "1 of 8",
                      recipe: "1200 g raw chicken breast, 300 g dry basmati, veg",
                    },
                  ],
                  whoop: {
                    recovery_score: 37,
                    hrv_rmssd_milli: 57.2,
                    resting_heart_rate: 66,
                    sleep_hours: 7.7,
                    strain: 0.86,
                    kcal: 1372,
                  },
                },
              },
            },
          },
        },
      },
      "/api/sessions": {
        get: {
          summary: "Read logged training sessions",
          parameters: [
            {
              name: "date",
              in: "query",
              schema: { type: "string", example: "2026-11-16" },
              description: "One day. Do not combine with from/to.",
            },
            {
              name: "from",
              in: "query",
              schema: { type: "string", example: "2026-11-16" },
              description: "Range start (inclusive). Requires to.",
            },
            {
              name: "to",
              in: "query",
              schema: { type: "string", example: "2026-11-22" },
              description: "Range end (inclusive). Requires from.",
            },
          ],
        },
        post: {
          summary: "Create or update one training session by id",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Session" },
                example: {
                  id: "session_2026-11-16_01",
                  date: "2026-11-16",
                  plan_id: "plan_2026-11-16",
                  plan_day: "mon",
                  completed: true,
                  rpe: 7,
                  feedback: "Stopped with reps in reserve.",
                  sets: [
                    {
                      exercise_key: "bench_press",
                      set: 1,
                      reps: 7,
                      load_kg: 50,
                      band: null,
                      hold_s: null,
                      done: true,
                    },
                  ],
                },
              },
            },
          },
        },
      },
      "/api/workouts": {
        get: {
          summary: "Read ingested workouts",
          description:
            "Same auth as /api/log. from and to are inclusive YYYY-MM-DD local dates, or omit both to read every activity. Returns {from, to, last_synced_at, activities}.",
          parameters: [
            { name: "from", in: "query", schema: { type: "string", example: "2026-11-07" } },
            { name: "to", in: "query", schema: { type: "string", example: "2026-11-13" } },
          ],
        },
        post: {
          summary: "Upsert workouts by strava_id",
          description:
            "Same auth as /api/log. Body is a JSON array of activities. Idempotent: the same strava_id updates the existing row. A repeated id in one batch keeps the last copy. Does not call Strava.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/WorkoutActivity" },
                },
              },
            },
          },
        },
      },
      "/api/strava/connect": {
        get: {
          summary: "Start a one-time Strava connection",
          description:
            "Same auth as /api/log. Redirects a signed-in browser to Strava. Requires STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET. Does not return tokens.",
        },
      },
      "/api/strava/callback": {
        get: {
          summary: "Finish the one-time Strava connection",
          description:
            "Strava redirects here with a code. The server exchanges it and stores the refresh token. The response never includes the code or the token.",
        },
      },
    },
  });
}
