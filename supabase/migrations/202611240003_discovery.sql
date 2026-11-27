begin;
alter table public.activities
  add column category text not null default 'social' check (category in ('sports','food','adventure','fitness','travel','gaming','study','music','photography','movies','social','other')),
  add column cost_inr numeric(10,2) not null default 0 check(cost_inr >= 0 and cost_inr <> 'NaN'::numeric);
grant insert(category,cost_inr) on public.activities to authenticated;
-- Avoid exposing participant identities to count seats.
create function public.available_spots(activity public.activities) returns integer
language sql stable security definer set search_path='' as $$
  select greatest(a.capacity - count(p.user_id)::integer,0) from public.activities a
    left join public.participations p on p.activity_id=a.id and p.status='accepted'
    where a.id=activity.id and sidequest_private.compatible(a.host_id) group by a.id
$$;
revoke all on function public.available_spots(public.activities) from public,anon;
grant execute on function public.available_spots(public.activities) to authenticated;
commit;
