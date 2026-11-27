begin;
create function sidequest_private.group_allows(q uuid,viewer uuid) returns boolean language sql stable security definer set search_path='' as $$
  select not exists(select 1 from public.participations p join public.user_blocks b
    on (b.blocker=p.user_id and b.blocked=viewer) or (b.blocked=p.user_id and b.blocker=viewer)
    where p.activity_id=q and p.status='accepted')
$$;
create or replace function sidequest_private.can_view(q uuid) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.activities a where a.id=q and sidequest_private.compatible(a.host_id)
    and (a.host_id=auth.uid() or (sidequest_private.group_allows(q,auth.uid()) and
      (a.visibility='public' or exists(select 1 from public.activity_invites i where i.activity_id=q and i.recipient=auth.uid())))))
$$;
create or replace function sidequest_private.member(q uuid) returns boolean language sql stable security definer set search_path='' as $$
  select sidequest_private.can_view(q) and exists(select 1 from public.participations where activity_id=q and user_id=auth.uid() and status='accepted')
$$;
create function sidequest_private.check_group() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status in ('accepted','pending') and not sidequest_private.group_allows(new.activity_id,new.user_id) then raise exception 'Activity unavailable';end if;
 return new;
end $$;
create trigger check_group before insert or update of status on public.participations for each row execute function sidequest_private.check_group();
commit;
