begin;
create schema sidequest_private;
revoke all on schema sidequest_private from public, anon, authenticated;

-- Only the trusted age-assurance process can populate this table.
create table sidequest_private.age_checks (
  user_id uuid primary key references auth.users on delete cascade,
  birth_date date not null,
  checked_at timestamptz not null default now()
);
create table public.user_blocks (
  blocker uuid not null default auth.uid() references auth.users on delete cascade,
  blocked uuid not null references auth.users on delete cascade,
  primary key (blocker, blocked), check (blocker <> blocked)
);
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null check (length(trim(title)) between 1 and 80),
  description text not null check (length(trim(description)) between 1 and 1000),
  area text not null check (length(trim(area)) between 1 and 100),
  starts_at timestamptz not null, ends_at timestamptz not null check (ends_at > starts_at),
  capacity integer not null check (capacity between 2 and 100),
  join_mode text not null check (join_mode in ('instant','approval')),
  state text not null default 'open' check (state in ('open','cancelled','completed')),
  created_at timestamptz not null default now()
);
create index activity_schedule on public.activities(starts_at,id) where state='open';
create table public.participations (
  activity_id uuid references public.activities on delete cascade,
  user_id uuid references auth.users on delete cascade,
  status text not null check (status in ('accepted','pending','left','rejected')),
  primary key(activity_id,user_id)
);
create index participation_by_user on public.participations(user_id,status);
create table public.activity_messages (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities on delete cascade,
  sender uuid not null default auth.uid() references auth.users on delete cascade,
  body text not null check(length(trim(body)) between 1 and 1500),
  created_at timestamptz not null default now()
);
create index activity_chat on public.activity_messages(activity_id,created_at,id);
create function sidequest_private.cohort(who uuid) returns integer
language sql stable security definer set search_path='' as $$
  select case when birth_date <= current_date - interval '18 years' then 18
              when birth_date <= current_date - interval '16 years' then 16 end
  from sidequest_private.age_checks where user_id=who
$$;
create function sidequest_private.compatible(other_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select sidequest_private.cohort(auth.uid()) = sidequest_private.cohort(other_id)
    and not exists(select 1 from public.user_blocks where
      (blocker=auth.uid() and blocked=other_id) or (blocker=other_id and blocked=auth.uid()))
$$;
create function sidequest_private.member(q uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.participations p join public.activities a on a.id=p.activity_id
    where a.id=q and p.user_id=auth.uid() and p.status='accepted' and sidequest_private.compatible(a.host_id))
$$;
alter table public.user_blocks enable row level security;
alter table public.activities enable row level security;
alter table public.participations enable row level security;
alter table public.activity_messages enable row level security;
revoke all on public.user_blocks, public.activities, public.participations, public.activity_messages from public, anon, authenticated;
grant select on public.activities, public.participations, public.activity_messages, public.user_blocks to authenticated;
grant insert (blocked), delete on public.user_blocks to authenticated;
grant insert (title,description,area,starts_at,ends_at,capacity,join_mode) on public.activities to authenticated;
grant insert (activity_id,body) on public.activity_messages to authenticated;
create policy own_blocks on public.user_blocks for all to authenticated using(blocker=auth.uid()) with check(blocker=auth.uid());
create policy discover on public.activities for select to authenticated using(sidequest_private.compatible(host_id));
create policy host_creates on public.activities for insert to authenticated with check
  (host_id=auth.uid() and sidequest_private.cohort(auth.uid()) is not null and starts_at>now());
create policy roster on public.participations for select to authenticated using
  (user_id=auth.uid() or exists(select 1 from public.activities a where a.id=activity_id and a.host_id=auth.uid())
   or (status='accepted' and sidequest_private.member(activity_id) and sidequest_private.compatible(user_id)));
create policy read_chat on public.activity_messages for select to authenticated using
  (sidequest_private.member(activity_id) and sidequest_private.compatible(sender));
create policy write_chat on public.activity_messages for insert to authenticated with check
  (sender=auth.uid() and sidequest_private.member(activity_id) and exists
     (select 1 from public.activities a where a.id=activity_id and a.state='open' and a.ends_at>now()));
create function sidequest_private.enroll_host() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  insert into public.participations values(new.id,new.host_id,'accepted');
  return new;
end $$;
create trigger enroll_host after insert on public.activities for each row execute function sidequest_private.enroll_host();

create function public.change_participation(q uuid, action text, target uuid default null) returns void
language plpgsql security definer set search_path='' as $$
declare
  a public.activities;
  actor uuid := auth.uid();
  who uuid := coalesce(target,actor);
  previous text;
  desired text;
begin
  select * into a from public.activities where id=q for update;
  if actor is null or a.id is null then raise exception 'Activity unavailable'; end if;
  if action in ('approve','reject','cancel','complete') then
    if actor<>a.host_id then raise exception 'Host required'; end if;
  elsif who<>actor then raise exception 'Cannot act for another participant'; end if;
  if action in ('complete','cancel') then
    if a.state<>'open' or (action='complete' and now()<a.starts_at) then raise exception 'Invalid activity transition'; end if;
    update public.activities set state=case action when 'complete' then 'completed' else 'cancelled' end where id=q;
    update public.participations set status='rejected' where activity_id=q and status='pending';
    return;
  end if;
  if who=a.host_id then raise exception 'Host membership is fixed'; end if;
  select status into previous from public.participations where activity_id=q and user_id=who;
  if action='leave' then
    if previous not in ('pending','accepted') or previous is null then raise exception 'No active membership'; end if;
    desired := 'left';
  elsif action='reject' and previous='pending' then desired := 'rejected';
  else
    if a.state<>'open' or a.starts_at<=now() or sidequest_private.compatible(a.host_id) is not true
       or sidequest_private.compatible(who) is not true then raise exception 'Activity unavailable'; end if;
    if action='join' and (previous is null or previous in ('left','rejected')) then
      desired := case a.join_mode when 'instant' then 'accepted' else 'pending' end;
    elsif action='approve' and previous='pending' then desired := 'accepted';
    else raise exception 'Invalid membership transition'; end if;
    if (select count(*) from public.participations where activity_id=q and status='accepted')>=a.capacity
      then raise exception 'Activity full'; end if;
  end if;
  insert into public.participations values(q,who,desired)
    on conflict(activity_id,user_id) do update set status=excluded.status;
end $$;
revoke all on function public.change_participation(uuid,text,uuid) from public,anon;
grant execute on function public.change_participation(uuid,text,uuid) to authenticated;
commit;
