begin;
create table public.push_devices (
  token text primary key check(token ~ '^(Expo|Exponent)PushToken\[[A-Za-z0-9_-]+\]$'),
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  updated_at timestamptz not null default now()
);
alter table public.push_devices enable row level security;
revoke all on public.push_devices from anon,authenticated,public;
grant insert(token),delete,select on public.push_devices to authenticated;
create policy own_devices on public.push_devices for all to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
create table sidequest_private.push_queue (
  alert_id bigint primary key references public.activity_alerts on delete cascade,
  available_at timestamptz not null default now(),
  attempts integer not null default 0,
  delivered_at timestamptz
);
create function sidequest_private.enqueue_alert() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  insert into sidequest_private.push_queue(alert_id) values(new.id) on conflict do nothing;
  return new;
end $$;
create trigger enqueue_alert after insert on public.activity_alerts for each row execute function sidequest_private.enqueue_alert();
-- Serialize writes by sender so concurrent clients cannot skip the burst limit.
create function sidequest_private.check_message_rate() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('message:'||new.sender::text,0));
 if (select count(*) from public.activity_messages where sender=new.sender and created_at>now()-interval '1 minute')>=20
   then raise exception 'Message limit reached. Try again in a minute.'; end if;
 return new;
end $$;
create index message_rate_window on public.activity_messages(sender,created_at);
create trigger check_message_rate before insert on public.activity_messages for each row execute function sidequest_private.check_message_rate();
create table sidequest_private.moderation_actions (
  id bigint generated always as identity primary key,
  report_id uuid not null references public.safety_reports on delete cascade,
  moderator_id uuid references auth.users on delete set null,
  action text not null, created_at timestamptz not null default now()
);
create table sidequest_private.activity_events (
  id bigint generated always as identity primary key, activity_id uuid not null references public.activities on delete cascade,
  actor uuid references auth.users on delete set null, event text not null, created_at timestamptz not null default now()
);
create function sidequest_private.record_state() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 insert into sidequest_private.activity_events(activity_id,actor,event) values(new.id,auth.uid(),new.state);
 if new.state='cancelled' then
   insert into public.activity_alerts(recipient,activity_id,body)
     select p.user_id,new.id,'Activity cancelled' from public.participations p
     left join public.account_profiles f on f.user_id=p.user_id
     where p.activity_id=new.id and p.status in ('pending','accepted') and p.user_id<>new.host_id and coalesce(f.activity_alerts,true);
 end if;
 return new;
end $$;
create trigger activity_state_changed after update of state on public.activities for each row
when (old.state is distinct from new.state) execute function sidequest_private.record_state();
commit;
