import { json } from "@/lib/auth";

export async function GET() {
  return json({
    openapi: "3.1.0",
    info: {
      title: "Training log",
      version: "1.0.0",
      description:
        "Personal food, water, weight and exercise log. The Grok Bot writes here; the website only displays it. Always send a stable id so a correction updates the same row.",
    },
    security: [{ bearerAuth: [] }],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer" },
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
                schema: { type: "object" },
                example: {
                  date: "2026-11-09",
                  foods: [
                    {
                      id: "food_2026-11-09_yogurt",
                      time: "12:30",
                      item: "Greek yogurt",
                      kcal: 150,
                      protein_g: 20,
                      carbs_g: 8,
                      fat_g: 4,
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },
  });
}
