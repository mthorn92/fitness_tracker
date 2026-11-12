-- Strava refresh token and a short run cache. Additive: nothing else reads these tables.
create table if not exists strava_token (
  id text primary key,
  refresh_token text not null,
  access_token text,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists strava_run_cache (
  id text primary key,
  since_date text not null,
  runs jsonb not null,
  fetched_at timestamptz not null default now()
);
