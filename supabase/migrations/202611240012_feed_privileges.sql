begin;
-- The RPC owner inherits authenticated RLS policies and owns no tables.
-- This limits snapshot creation to the bounded ranking routine.
create role sidequest_feed nologin inherit nobypassrls;
grant authenticated to sidequest_feed;
grant sidequest_feed to current_user;
grant create on schema public to sidequest_feed;
grant insert,select,delete on public.discovery_snapshots to sidequest_feed;
grant update(ranked) on public.discovery_snapshots to sidequest_feed;
revoke insert on public.discovery_snapshots from authenticated;
alter function public.recommend_activities(jsonb,jsonb,int) security definer;
alter function public.recommend_activities(jsonb,jsonb,int) owner to sidequest_feed;
revoke create on schema public from sidequest_feed;
revoke sidequest_feed from current_user;
commit;
