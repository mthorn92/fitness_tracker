-- Living documents for the Investing tab (research papers, later notes).
-- Additive: nothing else reads this table.
create table if not exists documents (
  slug text primary key,
  title text not null,
  markdown text not null,
  version integer not null,
  updated_at timestamptz not null default now()
);
