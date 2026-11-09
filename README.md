# Training log

A mobile-first personal fitness dashboard. **You log through a Grok Bot.** The website is for checking the day, not typing meals in.

The bot writes to a **database**. On your computer that is a local Postgres file (PGlite in `.data/`). When the app is published, Cursor provides a hosted Postgres database.

Your existing sample log is imported once so daily calories, macros and water match the current tracker.

There is still no live WHOOP connection. WHOOP rows from the sample file are imported so Recover has something to show. A Fitness (workouts / strength) section comes later.

## Run it on your computer

You need [Node.js](https://nodejs.org/) 20 or newer.

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

```bash
npm run lint
npm run build
npm run verify-import
```

`verify-import` checks that 9 Nov still totals 499 kcal, 41.6 g protein, 55.5 g carbs, 11 g fat and 1.3 L water.

## What you will see

- **Dashboard** — remaining calories (food vs budget), meals the bot logged, and the day's exercise amount. Exercise is shown but never added back into remaining calories or macros.
- **Log** — food, drinks, saved meals (quiet manual add for rare corrections)
- **Charts** — weight and calorie trends (daily dots + 7-day average)
- **Recover** — imported recovery, sleep and workouts

**DB** in the header means the screens are reading the database.

## How the Grok Bot logs

1. You tell the bot what you ate (or drank, or weighed).
2. It `POST`s `/api/log` with a stable `id` per item.
3. Sending the same `id` again **updates** that row instead of duplicating.
4. The website shows the same database.

The **website** stays Private (Cursor sign-in in the browser).

`/api` sits behind that same host gate. `Authorization: Bearer` never reaches the app until the host lets the request through. Automated callers (Grok Bot, curl) must send **both** headers:

1. `x-cursor-app-token: $CURSOR_API_KEY` — a Cursor API key from the Cursor dashboard. This is what skips the “Open this app” page.
2. `Authorization: Bearer $LOG_API_TOKEN` — the app secret. This is what `/api` actually checks.

| Method | Path | What it does |
| --- | --- | --- |
| GET | `/api/log?date=2026-11-09` | Read one day (includes saved meals) |
| POST | `/api/log` | **Main bot call** — log or correct food, water, weight, exercise for one date |
| GET | `/api/openapi` | Machine-readable API description |
| PATCH/DELETE | `/api/foods/:id` | Correct or remove one food |
| POST | `/api/water` `/api/weights` `/api/exercises` | Single-item writes if you prefer |

Test that the live OpenAPI spec is JSON, not the sign-in page:

```bash
curl -sS https://training-log.apps.grok.bot/api/openapi \
  -H "Authorization: Bearer $LOG_API_TOKEN" \
  -H "x-cursor-app-token: $CURSOR_API_KEY"
```

Log a meal, then correct it:

```bash
curl -X POST https://training-log.apps.grok.bot/api/log \
  -H 'content-type: application/json' \
  -H "Authorization: Bearer $LOG_API_TOKEN" \
  -H "x-cursor-app-token: $CURSOR_API_KEY" \
  -d '{
    "date": "2026-11-09",
    "foods": [{
      "id": "food_2026-11-09_yogurt",
      "time": "12:30",
      "item": "Greek yogurt",
      "kcal": 150,
      "protein_g": 20,
      "carbs_g": 8,
      "fat_g": 4
    }]
  }'

curl -X POST https://training-log.apps.grok.bot/api/log \
  -H 'content-type: application/json' \
  -H "Authorization: Bearer $LOG_API_TOKEN" \
  -H "x-cursor-app-token: $CURSOR_API_KEY" \
  -d '{
    "date": "2026-11-09",
    "foods": [{
      "id": "food_2026-11-09_yogurt",
      "time": "12:30",
      "item": "Greek yogurt",
      "kcal": 160,
      "protein_g": 20,
      "carbs_g": 8,
      "fat_g": 4
    }]
  }'
```

If `saved_meal` matches a saved meal (for example `chicken rice veg meal prep`), macros fill in when you omit them.

Locally, the API treats you as a simulated signed-in viewer, so curl works without either header. On the published private app, Bearer-only still hits the sign-in page; add the Cursor API key header.

## Where the data lives

| Path | What it is |
| --- | --- |
| `lib/data.ts` | What the website reads |
| `lib/store.ts` | Database reads and writes |
| `lib/apply-log.ts` | One-call bot ingest |
| `lib/db.ts` | Postgres or local PGlite |
| `migrations/` | Schema |
| `data/fitness.json` | One-time seed, only if the database is empty |
| `app/api/` | Authenticated bot/website API |

## Not included yet

- Wiring the Grok Bot’s connection to the published URL + token (test one meal first)
- A Fitness section for sessions / strength
- Live WHOOP sync (keep credentials on the server; dedupe by WHOOP id)
- Hosted backups beyond what the Cursor database provides
