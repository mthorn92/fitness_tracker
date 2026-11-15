-- Optional planned flag on a food line. Omitted writes stay false.
alter table foods add column if not exists planned boolean not null default false;
