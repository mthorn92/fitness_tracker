-- Logged strength and run sessions. Additive: nothing else reads this table.
create table if not exists sessions (
  id text primary key,
  date text not null,
  plan_id text,
  plan_day text,
  completed boolean not null default false,
  rpe double precision,
  feedback text,
  sets jsonb not null default '[]'::jsonb,
  duration_min double precision,
  avg_hr double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sessions_date_idx on sessions (date);
