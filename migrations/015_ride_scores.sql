-- Posted ride scores for the Exercise Rides tile.
-- Additive: new table only. Upsert key is strava_id when set, else ride_date + start_time.
create table if not exists ride_scores (
  row_key text primary key,
  strava_id text,
  ride_date text not null,
  start_time text,
  name text,
  duration_s double precision,
  distance_m double precision,
  avg_watts double precision,
  avg_rpm double precision,
  resistance_avg double precision,
  resistance_max double precision,
  incline_avg double precision,
  incline_max double precision,
  calories double precision,
  avg_hr double precision,
  max_hr double precision,
  p97_hr double precision,
  pct_under_145 double precision,
  drift_bpm double precision,
  w_per_bpm double precision,
  score_index double precision,
  disc_pts double precision,
  eff_pts double precision,
  dur_pts double precision,
  updated_at timestamptz not null default now()
);

create unique index if not exists ride_scores_strava_id_idx on ride_scores (strava_id) where strava_id is not null;
create index if not exists ride_scores_date_idx on ride_scores (ride_date desc);