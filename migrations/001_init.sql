create table if not exists profile (
  id text primary key,
  goal_weight_kg double precision not null,
  start_weight_kg double precision not null,
  start_date text not null,
  calories_kcal double precision not null,
  water_l double precision not null,
  fasting text not null,
  protein_g double precision not null,
  carbs_g double precision not null,
  fat_g double precision not null,
  updated_at timestamptz not null default now()
);

create table if not exists saved_meals (
  id text primary key,
  name text not null unique,
  serve text,
  recipe text,
  kcal double precision not null,
  protein_g double precision not null,
  carbs_g double precision not null,
  fat_g double precision not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists foods (
  id text primary key,
  date text not null,
  time text not null,
  item text not null,
  kcal double precision not null,
  protein_g double precision not null,
  carbs_g double precision not null,
  fat_g double precision not null,
  saved_meal text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists foods_date_idx on foods (date);

create table if not exists water_entries (
  id text primary key,
  date text not null,
  time text not null,
  item text not null,
  litres double precision not null,
  estimated boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists water_entries_date_idx on water_entries (date);

create table if not exists weights (
  id text primary key,
  date text not null unique,
  kg double precision not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists exercises (
  id text primary key,
  date text not null,
  time text,
  item text not null,
  duration_min double precision,
  kcal double precision not null default 0,
  whoop_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists exercises_date_idx on exercises (date);

create table if not exists day_notes (
  date text primary key,
  notes text,
  updated_at timestamptz not null default now()
);

create table if not exists whoop_cycles (
  id text primary key,
  waking_date text not null,
  start_at text,
  end_at text,
  timezone_offset text,
  strain double precision,
  kilojoule double precision,
  kcal double precision,
  average_heart_rate double precision,
  max_heart_rate double precision,
  step_count double precision,
  score_state text,
  updated_at text,
  sleep_id text
);

create table if not exists whoop_recovery (
  cycle_id text primary key,
  sleep_id text,
  waking_date text not null,
  recovery_score double precision,
  resting_heart_rate double precision,
  hrv_rmssd_milli double precision,
  spo2_percentage double precision,
  skin_temp_celsius double precision,
  score_state text,
  updated_at text
);

create table if not exists whoop_sleep (
  id text primary key,
  cycle_id text,
  waking_date text not null,
  start_at text,
  end_at text,
  timezone_offset text,
  nap boolean,
  asleep_hours double precision,
  in_bed_hours double precision,
  sleep_performance_percentage double precision,
  sleep_consistency_percentage double precision,
  sleep_efficiency_percentage double precision,
  respiratory_rate double precision,
  score_state text,
  updated_at text
);

create table if not exists whoop_workouts (
  id text primary key,
  date text not null,
  start_at text,
  end_at text,
  timezone_offset text,
  sport_name text not null,
  sport_id double precision,
  duration_min double precision,
  strain double precision,
  kilojoule double precision,
  kcal double precision,
  average_heart_rate double precision,
  max_heart_rate double precision,
  score_state text,
  updated_at text
);

create index if not exists whoop_workouts_date_idx on whoop_workouts (date);
