begin;
alter table public.activities add column requirements text not null default '' check(length(requirements)<=500),
  add column type_notes text not null default '' check(length(type_notes)<=300),
  add column team_size int check(team_size between 1 and capacity);
grant insert(requirements,type_notes,team_size) on public.activities to authenticated;
create function public.update_activity_details(q uuid, changes jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
  -- The common edit routine locks the row and verifies host, time and occupied capacity.
  perform public.edit_activity(q,changes->>'title',changes->>'description',changes->>'area',(changes->>'capacity')::int,
    (changes->>'starts_at')::timestamptz,(changes->>'ends_at')::timestamptz,changes->>'category',(changes->>'cost_inr')::numeric,changes->>'join_mode');
  update public.activities set activity_type=changes->>'activity_type',requirements=coalesce(changes->>'requirements',''),
    type_notes=coalesce(changes->>'type_notes',''), team_size=(changes->>'team_size')::int,
    latitude=(changes->>'latitude')::numeric,longitude=(changes->>'longitude')::numeric where id=q;
end $$;
create function public.activity_host(activity public.activities) returns text language sql stable security definer set search_path='' as $$
  select coalesce(p.display_name,'Activity host') from public.activities a left join public.account_profiles p on p.user_id=a.host_id
    where a.id=activity.id and sidequest_private.can_view(a.id)
$$;
revoke all on function public.update_activity_details(uuid,jsonb), public.activity_host(public.activities) from public,anon;
grant execute on function public.update_activity_details(uuid,jsonb), public.activity_host(public.activities) to authenticated;
commit;
