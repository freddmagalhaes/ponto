-- Nullable columns preserve existing records and their stored totals.
alter table public.time_records
  add column if not exists lunch_out timestamptz,
  add column if not exists lunch_in timestamptz;

-- An open lunch is valid until checkout; completed shifts require both punches.
alter table public.time_records add constraint time_records_lunch_order check (
  (lunch_out is null and lunch_in is null)
  or (
    lunch_out is not null
    and lunch_out > check_in
    and (lunch_in is null or lunch_in > lunch_out)
    and (check_out is null or (lunch_in is not null and check_out > lunch_in))
  )
);
