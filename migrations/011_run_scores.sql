-- Posted run scores for the Exercise Runs tile.
-- Additive: new table only. The site stores the index it is given.
create table if not exists run_scores (
  strava_id text primary key,
  run_date text not null,
  start_time text,
  name text,
  distance_m double precision,
  elev_gain_m double precision,
  elev_loss_m double precision,
  avg_hr double precision,
  p97_hr double precision,
  pct_under_145 double precision,
  ef_gap double precision,
  disc double precision,
  eff double precision,
  dist double precision,
  elev double precision,
  score_index double precision,
  updated_at timestamptz not null default now()
);

create index if not exists run_scores_date_idx on run_scores (run_date desc);
