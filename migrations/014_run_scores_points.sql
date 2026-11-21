alter table run_scores add column if not exists disc_pts double precision;
alter table run_scores add column if not exists eff_pts double precision;
alter table run_scores add column if not exists dist_pts double precision;
alter table run_scores add column if not exists elev_pts double precision;
alter table run_scores add column if not exists disc_max double precision;
alter table run_scores add column if not exists eff_max double precision;
alter table run_scores add column if not exists dist_max double precision;
alter table run_scores add column if not exists elev_max double precision;