begin;
alter table public.activities
  add column activity_type text not null default 'social' check (activity_type in ('team-sport','individual-sport','outdoor','food','creative','gaming','study','social')),
  add column latitude numeric(5,2) check(latitude between -90 and 90),
  add column longitude numeric(5,2) check(longitude between -180 and 180),
  add constraint coordinate_pair check ((latitude is null)=(longitude is null));
grant insert(activity_type,latitude,longitude) on public.activities to authenticated;
create index discovery_category_schedule on public.activities(category, starts_at, id) where state='open';

create table public.discovery_preferences (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  personalized boolean not null default true,
  learn boolean not null default false,
  categories text[] not null default '{}' check(cardinality(categories)<=12),
  types text[] not null default '{}' check(cardinality(types)<=8),
  weekdays int[] not null default '{}' check(weekdays <@ array[0,1,2,3,4,5,6]),
  budget numeric check(budget between 0 and 1000000),
  radius_km numeric check(radius_km between 1 and 1000),
  latitude numeric(5,2) check(latitude between -90 and 90),
  longitude numeric(5,2) check(longitude between -180 and 180),
  check ((latitude is null)=(longitude is null))
);
create table public.discovery_interactions (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  activity_id uuid not null references public.activities on delete cascade,
  kind text not null check(kind in ('impression','detail','save','dismiss','request','join','host','attendance','positive','negative')),
  happened_at timestamptz not null default now(),
  primary key(user_id,activity_id,kind)
);
create index discovery_history on public.discovery_interactions(user_id,happened_at desc);
create table public.discovery_snapshots (
  id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(), filters jsonb not null, ranked jsonb not null
);
create index discovery_snapshots_owner on public.discovery_snapshots(user_id,created_at desc);
alter table public.discovery_preferences enable row level security;
alter table public.discovery_interactions enable row level security;
alter table public.discovery_snapshots enable row level security;
revoke all on public.discovery_preferences,public.discovery_interactions,public.discovery_snapshots from public,anon,authenticated;
grant select,insert,update on public.discovery_preferences to authenticated;
grant select,delete on public.discovery_interactions to authenticated;
grant select,insert,delete on public.discovery_snapshots to authenticated;
create policy own_preferences on public.discovery_preferences for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy own_signals on public.discovery_interactions for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy own_pages on public.discovery_snapshots for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());

create function public.record_discovery(q uuid, event_kind text) returns void
language plpgsql security definer set search_path='' as $$
begin
  if event_kind is null or event_kind not in ('impression','detail','save','dismiss') or sidequest_private.can_view(q) is not true then
    raise exception 'Activity or interaction unavailable';
  end if;
  if event_kind in ('impression','detail') and not exists(select 1 from public.discovery_preferences where user_id=auth.uid() and personalized and learn) then return; end if;
  insert into public.discovery_interactions(user_id,activity_id,kind) values(auth.uid(),q,event_kind)
  on conflict do nothing;
end $$;
revoke all on function public.record_discovery(uuid,text) from public,anon;
grant execute on function public.record_discovery(uuid,text) to authenticated;

create function sidequest_private.learn_participation() returns trigger
language plpgsql security definer set search_path='' as $$
declare signal text;
begin
  if not exists(select 1 from public.discovery_preferences where user_id=new.user_id and personalized and learn) then return new; end if;
  if tg_table_name='attendance' then signal:='attendance';
  elsif tg_table_name='activity_feedback' then signal:=case when new.rating>=4 then 'positive' when new.rating<=2 then 'negative' end;
  elsif new.status='accepted' then signal:=case when exists(select 1 from public.activities where id=new.activity_id and host_id=new.user_id) then 'host' else 'join' end;
  elsif new.status='pending' then signal:='request';
  end if;
  if signal is not null then
    insert into public.discovery_interactions(user_id,activity_id,kind) values(new.user_id,new.activity_id,signal) on conflict do nothing;
  end if;
  return new;
end $$;
create trigger learn_membership after insert or update of status on public.participations for each row execute function sidequest_private.learn_participation();
create trigger learn_attendance after insert on public.attendance for each row execute function sidequest_private.learn_participation();
create trigger learn_feedback after insert on public.activity_feedback for each row execute function sidequest_private.learn_participation();
create table public.discovery_weights (
  version int primary key check(version=1),
  interest real not null, affinity real not null, distance real not null, schedule real not null,
  budget real not null, freshness real not null, capacity real not null, exploration real not null,
  check(least(interest,affinity,distance,schedule,budget,freshness,capacity,exploration)>=0 and
    abs(interest+affinity+distance+schedule+budget+freshness+capacity+exploration-1)<0.0001)
);
insert into public.discovery_weights values(1,.25,.20,.15,.15,.10,.05,.05,.05);
revoke all on public.discovery_weights from public,anon,authenticated;
grant select on public.discovery_weights to authenticated;
commit;
