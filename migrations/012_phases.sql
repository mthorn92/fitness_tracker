-- Calorie phases for the diet strip and phase-aware averages. Repo PHASES is the fallback when empty.

create table if not exists phases (
  id text primary key,
  name text not null,
  kind text,
  start text not null,
  "end" text,
  goal_weight_kg double precision,
  kcal_target integer,
  note text,
  updated_at timestamptz not null default now()
);

create index if not exists phases_start_idx on phases (start);