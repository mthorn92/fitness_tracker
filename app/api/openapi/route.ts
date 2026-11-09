import { json, requireLogAccess } from "@/lib/auth";

export async function GET(request: Request) {
  const access = await requireLogAccess(request);
  if (access instanceof Response) return access;

  return json({
    openapi: "3.1.0",
    info: {
      title: "Training log",
      version: "1.0.0",
      description:
        "Personal food, water, weight and exercise log. The Grok Bot writes here; the website only displays it. Always send a stable id so a correction updates the same row.",
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
