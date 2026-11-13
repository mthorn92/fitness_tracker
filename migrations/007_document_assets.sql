-- PNG files referenced by a living document. Additive: nothing else reads this table.
create table if not exists document_assets (
  slug text not null,
  path text not null,
  sha256 text not null,
  bytes bytea not null,
  content_type text not null,
  updated_at timestamptz not null default now(),
  primary key (slug, path)
);
