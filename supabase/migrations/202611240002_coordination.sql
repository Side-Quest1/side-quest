begin;
create table public.account_profiles (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  display_name text not null check(length(trim(display_name)) between 1 and 60),
  city text not null default '' check(length(city)<=100),
  interests text[] not null default '{}' check(cardinality(interests)<=12),
  activity_alerts boolean not null default true
);
create table public.activity_alerts (
  id bigint generated always as identity primary key,
  recipient uuid not null references auth.users on delete cascade,
  activity_id uuid not null references public.activities on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
create index alerts_by_recipient on public.activity_alerts(recipient,id desc);
create table public.safety_reports (
  id uuid primary key default gen_random_uuid(),
  reporter uuid not null default auth.uid() references auth.users on delete cascade,
  activity_id uuid references public.activities on delete cascade,
  reported_user uuid references auth.users on delete cascade,
  reason text not null check(length(trim(reason)) between 1 and 1500),
  state text not null default 'submitted' check(state in ('submitted','reviewing','resolved')),
  created_at timestamptz not null default now(),
  check(activity_id is not null or reported_user is not null)
);
create table public.attendance (
  activity_id uuid references public.activities on delete cascade,
  user_id uuid default auth.uid() references auth.users on delete cascade,
  confirmed_at timestamptz not null default now(),
  primary key(activity_id,user_id)
);
create table public.activity_feedback (
  activity_id uuid references public.activities on delete cascade,
  user_id uuid default auth.uid() references auth.users on delete cascade,
  rating integer not null check(rating between 1 and 5),
  comment text not null default '' check(length(comment)<=500),
  primary key(activity_id,user_id)
);
alter table public.account_profiles enable row level security;
alter table public.activity_alerts enable row level security;
alter table public.safety_reports enable row level security;
alter table public.attendance enable row level security;
alter table public.activity_feedback enable row level security;
revoke all on public.account_profiles,public.activity_alerts,public.safety_reports,public.attendance,public.activity_feedback from anon,authenticated,public;
grant select on public.account_profiles,public.activity_alerts,public.safety_reports,public.attendance,public.activity_feedback to authenticated;
grant insert(user_id,display_name,city,interests,activity_alerts),update(display_name,city,interests,activity_alerts,user_id) on public.account_profiles to authenticated;
grant insert(activity_id,reported_user,reason) on public.safety_reports to authenticated;
grant insert(activity_id) on public.attendance to authenticated;
grant insert(activity_id,rating,comment) on public.activity_feedback to authenticated;
create policy own_profile on public.account_profiles for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy personal_alerts on public.activity_alerts for select to authenticated using(recipient=auth.uid());
create policy personal_reports on public.safety_reports for all to authenticated using(reporter=auth.uid()) with check(reporter=auth.uid());
create policy confirm_attendance on public.attendance for all to authenticated using(user_id=auth.uid()) with check(
 user_id=auth.uid() and sidequest_private.member(activity_id) and exists(select 1 from public.activities a
 where a.id=activity_id and a.starts_at>now() and a.state='open'));
create policy participant_feedback on public.activity_feedback for all to authenticated using(user_id=auth.uid()) with check(
 user_id=auth.uid() and sidequest_private.member(activity_id) and exists(select 1 from public.activities a
 where a.id=activity_id and a.state='completed'));
create function sidequest_private.participation_alert() returns trigger
language plpgsql security definer set search_path='' as $$
declare host uuid; destination uuid;
begin
 select host_id into host from public.activities where id=new.activity_id;
 if new.user_id=host then return new; end if;
 destination := case when auth.uid()=host then new.user_id else host end;
 if coalesce((select activity_alerts from public.account_profiles where user_id=destination),true) then
   insert into public.activity_alerts(recipient,activity_id,body)
     values(destination,new.activity_id,'Participation status: '||new.status);
 end if;
 return new;
end $$;
create trigger membership_alert after insert or update of status on public.participations
for each row execute function sidequest_private.participation_alert();
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
   alter publication supabase_realtime add table public.activity_messages, public.activity_alerts;
 end if;
end $$;
commit;
