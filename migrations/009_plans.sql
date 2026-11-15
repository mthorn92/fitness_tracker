-- Stored training plans. Repo JSON remains the fallback when a plan is not stored.
-- day_slot on sessions is optional and additive.

create table if not exists plans (
  id text primary key,
  body jsonb not null,
  active boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table sessions add column if not exists day_slot text;
