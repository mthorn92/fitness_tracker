-- Meal label on each food (Breakfast, Lunch, Dinner, Snacks, Dessert, …)
alter table foods add column if not exists meal text;

-- Extra exercise fields the Grok Bot can log
alter table exercises add column if not exists strain double precision;
alter table exercises add column if not exists avg_hr double precision;
alter table exercises add column if not exists source text;

-- Day-level complete flag (separate from notes so notes can still be cleared)
create table if not exists day_flags (
  date text primary key,
  complete boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Day-level WHOOP summary written by the bot (distinct from synced whoop_* tables)
create table if not exists day_whoop (
  date text primary key,
  cycle_id double precision,
  recovery_score double precision,
  hrv_rmssd_milli double precision,
  resting_heart_rate double precision,
  sleep_hours double precision,
  strain double precision,
  kcal double precision,
  step_count double precision,
  updated_at timestamptz not null default now()
);
