begin;
create table sidequest_private.push_deliveries (
  id bigint generated always as identity primary key,
  alert_id bigint not null references public.activity_alerts on delete cascade,
  token text not null references public.push_devices on delete cascade,
  ticket text, lease uuid, next_attempt timestamptz not null default now(), attempts integer not null default 0,
  state text not null default 'pending' check(state in ('pending','delivered','failed')),
  unique(alert_id,token)
);
create index push_due on sidequest_private.push_deliveries(next_attempt) where state='pending';
create function sidequest_private.expand_push() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into sidequest_private.push_deliveries(alert_id,token)
  select new.id,d.token from public.push_devices d where d.owner_id=new.recipient;
  return new;
end $$;
create trigger expand_push after insert on public.activity_alerts for each row execute function sidequest_private.expand_push();
create function public.claim_push_work() returns table(id bigint,lease uuid,token text,ticket text,activity_id uuid,body text)
language sql security definer set search_path='' as $$
  with due as (
    select d.id from sidequest_private.push_deliveries d join public.activity_alerts a on a.id=d.alert_id
    join public.activities q on q.id=a.activity_id join public.push_devices dev on dev.token=d.token and dev.owner_id=a.recipient
    left join public.account_profiles f on f.user_id=a.recipient
    where d.state='pending' and d.next_attempt<=now() and d.attempts<12 and a.created_at>now()-interval '1 day'
      and coalesce(f.activity_alerts,true) and sidequest_private.cohort(q.host_id)=sidequest_private.cohort(a.recipient)
      and not exists(select 1 from public.user_blocks b where (b.blocker=q.host_id and b.blocked=a.recipient) or (b.blocker=a.recipient and b.blocked=q.host_id))
    order by d.next_attempt,d.id limit 30 for update of d skip locked
  ), claimed as (
    update sidequest_private.push_deliveries d set lease=gen_random_uuid(),next_attempt=now()+interval '5 minutes',attempts=attempts+1
    from due where d.id=due.id returning d.*
  ) select c.id,c.lease,c.token,c.ticket,a.activity_id,a.body from claimed c join public.activity_alerts a on a.id=c.alert_id
$$;
create function public.finish_push_work(job bigint,lease_id uuid,outcome text,receipt text default null) returns void
language plpgsql security definer set search_path='' as $$
declare d sidequest_private.push_deliveries;
begin
  select * into d from sidequest_private.push_deliveries where id=job and lease=lease_id and state='pending' for update;
  if d.id is null then return; end if;
  if outcome='invalid_device' then delete from public.push_devices where token=d.token;return;end if;
  update sidequest_private.push_deliveries set lease=null,ticket=coalesce(receipt,d.ticket),
    state=case when outcome='delivered' then 'delivered' when outcome='failed' or d.attempts>=12 then 'failed' else 'pending' end,
    next_attempt=now()+case when outcome='ticket' then interval '15 minutes' else interval '1 minute'*least(60,power(2,d.attempts)) end
    where id=job;
  if outcome='delivered' then update sidequest_private.push_queue set delivered_at=now() where alert_id=d.alert_id
    and not exists(select 1 from sidequest_private.push_deliveries where alert_id=d.alert_id and state<>'delivered');end if;
end $$;
revoke all on function public.claim_push_work(),public.finish_push_work(bigint,uuid,text,text) from public,anon,authenticated;
do $$ begin if exists(select 1 from pg_roles where rolname='service_role') then
  grant execute on function public.claim_push_work(),public.finish_push_work(bigint,uuid,text,text) to service_role;
end if;end $$;
commit;
