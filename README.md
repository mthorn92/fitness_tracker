# Training log

A mobile-first personal fitness dashboard. It currently reads **sample data** from one JSON file. There is no login, no backend, and no live WHOOP connection yet.

## Run it on your computer

You need [Node.js](https://nodejs.org/) 20 or newer.

In a terminal, from this folder:

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

Other useful commands:

```bash
npm run lint
npm run build
npm start
```

`npm run build` checks that the app compiles. `npm start` serves the production build (run `build` first).

## What you will see

- **Today** — weight, recovery snapshot, calories, macros, water, and food so far
- **Log** — the day's food, drinks, and saved meals
- **Recover** — recovery, sleep, recent days, and workouts from the sample file
- **Body** — start / current / goal weight and daily targets

The green **Sample data** chip is a reminder that this is not a live backend.

## Where the data comes from

Every screen reads through **one file**: `lib/data.ts`.

That file loads `data/fitness.json`. Pages and components do not import the JSON themselves. Later, you can keep the same function names and swap the JSON import for a real API call.

```ts
// lib/data.ts
export async function getFitnessData() {
  // Today: sample JSON
  return sampleData;

  // Later: a real backend
  // const response = await fetch("https://your-api.example/fitness");
  // return response.json();
}
```

To try your own numbers, edit `data/fitness.json` and refresh the browser.

## Folder map

| Path | What it is |
| --- | --- |
| `app/` | Pages. Each folder is a screen. |
| `app/page.tsx` | Today |
| `app/log/page.tsx` | Food and water log |
| `app/recovery/page.tsx` | Recovery, sleep, workouts |
| `app/body/page.tsx` | Weight and targets |
| `components/` | Reusable UI pieces |
| `lib/data.ts` | **Only place that reads data** |
| `lib/types.ts` | TypeScript shapes for that data |
| `lib/format.ts` | Date, time, and number formatting |
| `data/fitness.json` | Sample snapshot |

## Not included yet

- Login
- Saving new food or weight
- A real database
- Live WHOOP sync (the sample file already contains recovery, sleep, and workout numbers so the screens have something to show)
