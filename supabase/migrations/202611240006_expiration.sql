begin;
alter table public.activities drop constraint activities_state_check;
alter table public.activities add constraint activities_state_check check(state in ('open','completed','cancelled','expired'));
create table sidequest_private.reminders (
  activity_id uuid references public.activities on delete cascade,
  user_id uuid references auth.users on delete cascade,
  primary key(activity_id,user_id)
);
create function sidequest_private.tick() returns void language plpgsql security definer set search_path='' as $$
begin
  with expired as (
    update public.activities set state='expired' where state='open' and ends_at<=now() returning id
  ) update public.participations set status='rejected' where status='pending' and activity_id in (select id from expired);
  with due as (
    insert into sidequest_private.reminders(activity_id,user_id)
    select a.id,p.user_id from public.activities a join public.participations p on p.activity_id=a.id
    left join public.account_profiles f on f.user_id=p.user_id
    where a.state='open' and a.starts_at between now() and now()+interval '1 hour' and p.status='accepted'
      and coalesce(f.activity_alerts,true) and not exists(select 1 from public.user_blocks b where
      (b.blocker=a.host_id and b.blocked=p.user_id) or (b.blocker=p.user_id and b.blocked=a.host_id))
    on conflict do nothing returning activity_id,user_id
  ) insert into public.activity_alerts(activity_id,recipient,body)
    select activity_id,user_id,'Your activity starts within the hour.' from due;
end $$;
revoke all on function sidequest_private.tick() from public,anon,authenticated;
do $$ begin
  if exists(select 1 from pg_extension where extname='pg_cron') then
    perform cron.schedule('sidequest-minute','* * * * *','select sidequest_private.tick()');
  end if;
end $$;
commit;
