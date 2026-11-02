begin;
create temporary table correction_test (like public.time_records including defaults including constraints including indexes);
create trigger test_revision before update on correction_test for each row execute function ponto_private.audit_manual_time_record();
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
insert into correction_test(id, employee_id, date, check_in, check_out, worked_minutes)
values ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','2026-10-30','2026-10-30 08:00-03','2026-10-30 18:00-03',600),
       ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','2026-10-31','2026-10-31 08:00-03','2026-10-31 18:00-03',600);
update correction_test set date='2026-10-29',check_in='2026-10-29 08:00-03',check_out='2026-10-29 18:00-03',lunch_out='2026-10-29 12:00-03',lunch_in='2026-10-29 13:00-03',worked_minutes=540,overtime_minutes=60
where id='10000000-0000-0000-0000-000000000001';
do $$ begin
  if (select count(*) from public.time_record_revisions where time_record_id='10000000-0000-0000-0000-000000000001' and before_record->>'date'='2026-10-30' and after_record->>'date'='2026-10-29' and changed_by='00000000-0000-0000-0000-000000000001') <> 1 then raise exception 'Audit snapshot failed'; end if;
  begin
    update correction_test set date='2026-10-31' where id='10000000-0000-0000-0000-000000000001';
    raise exception 'Duplicate date accepted';
  exception when unique_violation then null; end;
  begin
    update correction_test set date='2099-01-01' where id='10000000-0000-0000-0000-000000000001';
    raise exception 'Future date accepted';
  exception when check_violation then null; end;
  if (select count(*) from public.time_record_revisions where time_record_id='10000000-0000-0000-0000-000000000001') <> 1 then raise exception 'Failed edit leaked audit revision'; end if;
end $$;
grant select, update on correction_test to authenticated;
set local role authenticated;
do $$ begin
  if (select count(*) from public.time_record_revisions where time_record_id='10000000-0000-0000-0000-000000000001') <> 1 then raise exception 'Own revisions not visible'; end if;
  update correction_test set check_out='2026-10-29 19:00-03', worked_minutes=600, overtime_minutes=120 where id='10000000-0000-0000-0000-000000000001';
  if (select count(*) from public.time_record_revisions where time_record_id='10000000-0000-0000-0000-000000000001') <> 2 then raise exception 'Authenticated update audit failed'; end if;
  begin
    delete from public.time_record_revisions where time_record_id='10000000-0000-0000-0000-000000000001';
    raise exception 'User can delete audit';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
do $$ begin
  if (select count(*) from public.time_record_revisions where time_record_id='10000000-0000-0000-0000-000000000001') <> 0 then raise exception 'Other user can see audit'; end if;
end $$;
select 'PASS: date correction, immutable snapshots, duplicate/future rejection, revision RLS' as result;
rollback;
