begin;

create table sidequest_private.age_verification_requests (
  user_id uuid primary key references auth.users on delete cascade,
  birth_date date not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users on delete set null
);
revoke all on sidequest_private.age_verification_requests from public, anon, authenticated;

create function public.submit_age_verification(birth_date date) returns text
language plpgsql security definer set search_path='' as $$
declare actor uuid := auth.uid();
begin
  if actor is null then raise exception 'Sign in is required'; end if;
  if birth_date is null or birth_date > current_date - interval '16 years'
     or birth_date < current_date - interval '120 years' then
    raise exception 'Enter a valid date of birth for a person aged 16 or older';
  end if;
  if exists(select 1 from sidequest_private.age_checks where user_id=actor) then return 'approved'; end if;
  insert into sidequest_private.age_verification_requests(user_id,birth_date,status,submitted_at,reviewed_at,reviewed_by)
    values(actor,birth_date,'pending',now(),null,null)
  on conflict(user_id) do update set birth_date=excluded.birth_date,status='pending',submitted_at=now(),reviewed_at=null,reviewed_by=null;
  return 'pending';
end $$;

create function public.my_age_verification_status() returns text
language sql stable security definer set search_path='' as $$
  select case when exists(select 1 from sidequest_private.age_checks where user_id=auth.uid()) then 'approved'
    else coalesce((select status from sidequest_private.age_verification_requests where user_id=auth.uid()),'not_requested') end
$$;

create function public.my_moderator_status() returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from sidequest_private.moderators where user_id=auth.uid())
$$;

create function public.pending_age_verifications()
returns table(user_id uuid,birth_date date,submitted_at timestamptz)
language sql stable security definer set search_path='' as $$
  select r.user_id,r.birth_date,r.submitted_at
  from sidequest_private.age_verification_requests r
  where r.status='pending' and exists(select 1 from sidequest_private.moderators where user_id=auth.uid())
  order by r.submitted_at
$$;

create function public.review_age_verification(requester uuid,decision text) returns void
language plpgsql security definer set search_path='' as $$
declare request sidequest_private.age_verification_requests;
begin
  if not exists(select 1 from sidequest_private.moderators where user_id=auth.uid()) then raise exception 'Moderator required'; end if;
  if decision not in ('approve','reject') or requester is null then raise exception 'Invalid age verification decision'; end if;
  select * into request from sidequest_private.age_verification_requests where user_id=requester and status='pending' for update;
  if request.user_id is null then raise exception 'Verification request unavailable'; end if;
  if decision='approve' then
    insert into sidequest_private.age_checks(user_id,birth_date,checked_at) values(request.user_id,request.birth_date,now())
    on conflict(user_id) do update set birth_date=excluded.birth_date,checked_at=excluded.checked_at;
  end if;
  update sidequest_private.age_verification_requests
    set status=case when decision='approve' then 'approved' else 'rejected' end, reviewed_at=now(),reviewed_by=auth.uid()
    where user_id=request.user_id;
end $$;

revoke all on function public.submit_age_verification(date), public.my_age_verification_status(), public.my_moderator_status(), public.pending_age_verifications(), public.review_age_verification(uuid,text) from public, anon;
grant execute on function public.submit_age_verification(date), public.my_age_verification_status(), public.my_moderator_status(), public.pending_age_verifications(), public.review_age_verification(uuid,text) to authenticated;
commit;
