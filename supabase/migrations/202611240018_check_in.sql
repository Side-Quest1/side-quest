begin;
alter table public.attendance add column arrived_at timestamptz;
drop trigger learn_attendance on public.attendance;
create trigger learn_checkin after insert or update of arrived_at on public.attendance for each row
  when (new.arrived_at is not null) execute function sidequest_private.learn_participation();
create function public.check_in_activity(q uuid) returns void language plpgsql security definer set search_path='' as $$
begin
  if not sidequest_private.member(q) or not exists(select 1 from public.activities where id=q and
      state<>'cancelled' and now() between starts_at and ends_at+interval '24 hours') then raise exception 'Check-in is unavailable';end if;
  insert into public.attendance(activity_id,user_id,arrived_at) values(q,auth.uid(),now())
    on conflict(activity_id,user_id) do update set arrived_at=excluded.arrived_at where public.attendance.arrived_at is null;
end $$;
revoke all on function public.check_in_activity(uuid) from public,anon;
grant execute on function public.check_in_activity(uuid) to authenticated;
commit;
