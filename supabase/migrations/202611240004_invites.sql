begin;
alter table public.activities add column visibility text not null default 'public'
  check(visibility in ('public','invite-only'));
grant insert(visibility) on public.activities to authenticated;
create table public.activity_invites (
  activity_id uuid references public.activities on delete cascade,
  recipient uuid references auth.users on delete cascade,
  primary key(activity_id,recipient)
);
alter table public.activity_invites enable row level security;
revoke all on public.activity_invites from public,anon,authenticated;
grant select,insert on public.activity_invites to authenticated;
create function sidequest_private.can_view(q uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.activities a where a.id=q and sidequest_private.compatible(a.host_id)
    and (a.visibility='public' or a.host_id=auth.uid() or exists(select 1 from public.activity_invites i
      where i.activity_id=q and i.recipient=auth.uid())))
$$;
alter policy discover on public.activities using(sidequest_private.can_view(id) or (host_id=auth.uid() and sidequest_private.compatible(host_id)));
create policy see_invites on public.activity_invites for select to authenticated using(recipient=auth.uid()
  or exists(select 1 from public.activities a where a.id=activity_id and a.host_id=auth.uid()));
create policy invite_peer on public.activity_invites for insert to authenticated with check(sidequest_private.compatible(recipient)
  and exists(select 1 from public.activities a where a.id=activity_id and a.host_id=auth.uid() and a.state='open' and a.starts_at>now()));
-- All insert/update paths, including privileged enrollment RPCs, check the invitation.
create function sidequest_private.check_invite() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.status in ('pending','accepted') and exists(select 1 from public.activities a where a.id=new.activity_id
   and a.visibility='invite-only' and a.host_id<>new.user_id) and not exists(select 1 from public.activity_invites i
   where i.activity_id=new.activity_id and i.recipient=new.user_id) then raise exception 'Invitation required'; end if;
 return new;
end $$;
create trigger require_invite before insert or update on public.participations for each row execute function sidequest_private.check_invite();
create or replace function public.available_spots(activity public.activities) returns integer
language sql stable security definer set search_path='' as $$
  select greatest(a.capacity - count(p.user_id)::integer,0) from public.activities a
    left join public.participations p on p.activity_id=a.id and p.status='accepted'
    where a.id=activity.id and sidequest_private.can_view(a.id) group by a.id
$$;
commit;
