import { json, requireLogAccess } from "@/lib/auth";

export async function GET(request: Request) {
  const access = await requireLogAccess(request);
  if (access instanceof Response) return access;

  return json({
    openapi: "3.1.0",
    info: {
      title: "Training log",
      version: "1.1.0",
      description:
        "Personal food, water, weight, exercise, WHOOP and saved-meal log. The Grok Bot writes here; the website only displays it. Always send a stable id so a correction updates the same row. Saved meals upsert by name.",
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
    },
  });
}
