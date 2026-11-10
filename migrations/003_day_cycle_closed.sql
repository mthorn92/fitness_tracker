-- Optional day-level WHOOP cycle closed flag (additive; existing callers ignore it)
alter table day_flags add column if not exists cycle_closed boolean;
