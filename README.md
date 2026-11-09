# Training log

A mobile-first personal fitness dashboard. The website reads from a **database**. On your computer that is a local Postgres file (PGlite in `.data/`). When the app is published, Cursor provides a hosted Postgres database.

Your existing sample log is imported once into that database so daily calories, macros and water match the current tracker.

There is still no live WHOOP connection. WHOOP rows from the sample file are imported so Recover has something to show. WHOOP credentials should live on the server later, and workouts should be deduplicated by WHOOP id.

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

- **Dashboard** — remaining calories, meals, Add Food (saves to the database)
- **Log** — food, drinks, saved meals
- **Goals** — weight chart and Record Weight (saves to the database)
- **Recover** — imported recovery, sleep and workouts

**DB** in the header means the screens are reading the database, not rendering the JSON file directly.

## How logging is supposed to work

1. You log from a Grok Bot (or from the website).
2. The bot calls a small authenticated API.
3. Entries are stored with unique IDs, so sending the same id again **updates** instead of duplicating.
4. The website reads that same database.

### API for the bot

All of these need either a Cursor sign-in (the published private app) or `Authorization: Bearer <LOG_API_TOKEN>`.

| Method | Path | What it does |
| --- | --- | --- |
| GET | `/api/log?date=2026-11-09` | Read one day |
| GET | `/api/log` | Read the full snapshot |
| POST | `/api/foods` | Create or update a food (`id` optional; send the same id to correct) |
| PATCH | `/api/foods/:id` | Correct a food |
| DELETE | `/api/foods/:id` | Remove a food |
| POST | `/api/water` | Create or update a drink |
| PATCH | `/api/water/:id` | Correct a drink |
| POST | `/api/weights` | Upsert a weigh-in for a date |
| POST | `/api/exercises` | Log exercise (`whoop_id` unique later) |
| GET/PUT | `/api/targets` | Read or update targets |

Example: log a meal, then correct it.

```bash
curl -X POST http://localhost:3000/api/foods \
  -H 'content-type: application/json' \
  -d '{"id":"food_demo_1","date":"2026-11-09","time":"19:00","item":"Greek yogurt","kcal":150,"protein_g":20,"carbs_g":8,"fat_g":4}'

curl -X PATCH http://localhost:3000/api/foods/food_demo_1 \
  -H 'content-type: application/json' \
  -d '{"kcal":160}'
```

Locally, the API treats you as a simulated signed-in viewer, so curl works without a token. The published app requires a real login or `LOG_API_TOKEN`.

## Where the data lives

| Path | What it is |
| --- | --- |
| `lib/data.ts` | What the website reads |
| `lib/store.ts` | Database reads and writes |
| `lib/db.ts` | Postgres or local PGlite |
| `migrations/` | Schema |
| `data/fitness.json` | One-time seed, only if the database is empty |
| `app/api/` | Authenticated bot/website API |

## Not included yet

- Live WHOOP sync (keep credentials on the server; dedupe by WHOOP id)
- Switching the Grok Bot workflow over (test a meal here first)
- Hosted backups beyond what the Cursor database provides
