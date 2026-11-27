begin;
create function public.clear_discovery_history() returns void language sql security invoker set search_path='' as $$
  delete from public.discovery_interactions where user_id=auth.uid();
  delete from public.discovery_snapshots where user_id=auth.uid();
$$;
revoke all on function public.clear_discovery_history() from public,anon;
grant execute on function public.clear_discovery_history() to authenticated;
create function sidequest_private.invalidate_preferences() returns trigger language plpgsql security definer set search_path='' as $$
begin
  delete from public.discovery_snapshots where user_id=new.user_id;
  return new;
end $$;
create trigger invalidate_preferences after insert or update on public.discovery_preferences for each row execute function sidequest_private.invalidate_preferences();
create trigger invalidate_interests after update of interests on public.account_profiles for each row execute function sidequest_private.invalidate_preferences();
commit;
