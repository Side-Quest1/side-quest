begin;
alter table public.discovery_interactions add column visible_days integer not null default 1,
 add column last_visible date not null default current_date;
create or replace function public.record_discovery(q uuid,event_kind text) returns void
language plpgsql security definer set search_path='' as $$
begin
  if event_kind is null or event_kind not in ('impression','detail','save','dismiss') or sidequest_private.can_view(q) is not true then
    raise exception 'Activity or interaction unavailable';
  end if;
  if event_kind in ('impression','detail') and not exists(select 1 from public.discovery_preferences where user_id=auth.uid() and personalized and learn) then return; end if;
  insert into public.discovery_interactions as h(user_id,activity_id,kind) values(auth.uid(),q,event_kind)
  on conflict(user_id,activity_id,kind) do update set visible_days=h.visible_days+1,last_visible=current_date
    where event_kind='impression' and h.last_visible<current_date;
end $$;
-- Operator-only aggregates. Every outcome is attributed to a previously seen activity.
create view sidequest_private.discovery_quality as
with first_hosted as (select host_id,min(created_at) as first_at from public.activities group by host_id),
outcomes as (
  select i.user_id,i.activity_id,i.visible_days,a.category,a.host_id,
    i.happened_at<h.first_at+interval '30 days' as new_host,
    bool_or(e.kind='detail') as opened,bool_or(e.kind='join') as joined,
    bool_or(e.kind='attendance') as confirmed,bool_or(e.kind='dismiss') as dismissed
  from public.discovery_interactions i join public.activities a on a.id=i.activity_id
  join first_hosted h on h.host_id=a.host_id
  join public.discovery_preferences pref on pref.user_id=i.user_id and pref.personalized and pref.learn
  left join public.discovery_interactions e on e.user_id=i.user_id and e.activity_id=i.activity_id and e.happened_at>=i.happened_at
  where i.kind='impression' and i.happened_at>=now()-interval '30 days'
  group by i.user_id,i.activity_id,i.visible_days,a.category,a.host_id,i.happened_at,h.first_at
)
select count(*) as unique_exposures,count(distinct category) as categories_reached,count(distinct host_id) as hosts_reached,
  avg(opened::int) as detail_rate,avg(joined::int) as join_rate,
  count(*) filter(where joined and confirmed)::numeric/nullif(count(*) filter(where joined),0) as confirmed_attendance_rate,
  avg(dismissed::int) as dismissal_rate,avg(new_host::int) as new_host_share,avg((visible_days>1)::int) as repeat_day_share
from outcomes having count(distinct user_id)>=10;
revoke all on sidequest_private.discovery_quality from public,anon,authenticated;
commit;
