-- Workouts ingested by the Fitness Coach bot. Additive: the page reads this table
-- instead of calling Strava. Existing tables are left as they are.
create table if not exists workouts (
  strava_id bigint primary key,
  start_time timestamptz not null,
  start_time_iso text not null,
  local_date text not null,
  type text not null,
  sport_type text not null,
  name text not null,
  distance_m double precision not null,
  moving_time_s integer not null,
  elapsed_time_s integer not null,
  avg_hr double precision,
  max_hr double precision,
  kcal double precision,
  elevation_m double precision,
  updated_at timestamptz not null default now()
);

create index if not exists workouts_local_date_idx on workouts (local_date);
