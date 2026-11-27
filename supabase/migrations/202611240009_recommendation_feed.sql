begin;
-- Invoker rights preserve the same activity, block and invitation policies as details.
create function public.recommend_activities(options jsonb default '{}', after_cursor jsonb default null, page_size int default 12)
returns jsonb language plpgsql security invoker set search_path='' set statement_timeout='6s' as $$
declare
  actor uuid := auth.uid();
  sid uuid;
  skip_count int := 0;
  ranking jsonb;
  result jsonb;
  tz text := coalesce(options->>'timezone','UTC');
  pref public.discovery_preferences;
  terms text[];
begin
  if actor is null or page_size is null or page_size not between 1 and 40 then raise exception 'Invalid discovery request'; end if;
  if after_cursor is null then
    delete from public.discovery_snapshots where user_id=actor and
      (created_at<now()-interval '15 minutes' or id in (select id from public.discovery_snapshots where user_id=actor order by created_at desc offset 3));
    insert into public.discovery_snapshots(filters,ranked) values(options,'[]') returning id into sid;
    select * into pref from public.discovery_preferences where user_id=actor;
    select interests into terms from public.account_profiles where user_id=actor;
    with history as materialized (
      select h.activity_id,h.kind,h.happened_at,a.category
      from (select * from public.discovery_interactions where user_id=actor and pref.learn and pref.personalized
            and happened_at>now()-interval '180 days' order by happened_at desc limit 1000) h
      join public.activities a on a.id=h.activity_id
    ), affinities as (
      select category,sum(exp(-extract(epoch from (now()-happened_at))/5184000) *
        case kind when 'attendance' then 4 when 'positive' then 4 when 'negative' then -5 when 'host' then 3
        when 'join' then 3 when 'request' then 1 when 'save' then 2 else 0 end) as strength
      from history group by category
    ), candidates as materialized (
      select a.*,a.xmin::text as row_version,seats.spots,geo.km
      from public.activities a
      cross join lateral (select public.available_spots(a) as spots) seats
      cross join lateral (select 12742*asin(sqrt(least(1::float8,
        sin(radians((a.latitude-pref.latitude)::float8)/2)^2 +
        cos(radians(a.latitude::float8))*cos(radians(pref.latitude::float8))*sin(radians((a.longitude-pref.longitude)::float8)/2)^2))) as km) geo
      where a.state='open' and a.starts_at>now() and a.host_id<>actor and seats.spots>=greatest(1,(options->>'spots')::int)
        and (not options ? 'category' or a.category=options->>'category')
        and (not options ? 'type' or a.activity_type=options->>'type')
        and (not options ? 'mode' or a.join_mode=options->>'mode')
        and (not options ? 'budget' or a.cost_inr<=(options->>'budget')::numeric)
        and (not options ? 'from' or a.starts_at>=(options->>'from')::timestamptz)
        and (not options ? 'until' or a.starts_at<(options->>'until')::timestamptz)
        and (not options ? 'distance' or (a.latitude is not null and pref.latitude is not null and geo.km<=(options->>'distance')::numeric))
        and (not options ? 'search' or position(lower(options->>'search') in lower(a.title||' '||a.area))>0)
        and not exists(select 1 from public.participations m where m.activity_id=a.id and m.user_id=actor and m.status in ('pending','accepted'))
        and not exists(select 1 from public.discovery_interactions h where h.user_id=actor and h.activity_id=a.id and h.kind='dismiss')
      order by a.starts_at,a.id limit 240
    ), signals as (
      select a.*,coalesce(pref.personalized,true) as personalize,af.strength,
        (select t from unnest(terms) t where length(trim(t))>=2 and
          position(lower(trim(t)) in lower(a.title||' '||a.category||' '||a.description))>0 order by length(t) desc,t limit 1) as match_term,
        a.category=any(pref.categories) or a.activity_type=any(pref.types) as favorite,
        extract(dow from a.starts_at at time zone tz)::int=any(pref.weekdays) as fits_day,
        a.latitude is not null and pref.latitude is not null and pref.radius_km is not null as has_distance,
        exists(select 1 from history h where h.activity_id=a.id and h.kind='impression') as seen
      from candidates a left join affinities af using(category)
    ), scored as (
      select s.*, w.interest * case when not personalize or coalesce(cardinality(terms),0)=0 then .5 when match_term is not null then 1 else 0 end +
        w.affinity * case when not personalize then .5 when favorite then 1 else .5+.5*tanh(coalesce(strength,0)::float8/6) end +
        w.distance * case when personalize and has_distance then greatest(0,1-km/(2*pref.radius_km)) else .5 end +
        w.schedule * case when not personalize or coalesce(cardinality(pref.weekdays),0)=0 then .5 when fits_day then 1 else 0 end +
        w.budget * case when not personalize or pref.budget is null then .5 when cost_inr<=pref.budget then 1 else pref.budget/cost_inr end +
        w.freshness * exp(-greatest(0,extract(epoch from now()-s.created_at))/604800) +
        w.capacity * spots::float8/s.capacity +
        w.exploration * case when not personalize or not coalesce(pref.learn,false) then .5 when seen then 0 when strength is null then 1 else .5 end as base_score,
        case when personalize and match_term is not null then 'Matches your interest in '||match_term||'.'
        when personalize and favorite then 'Matches your preferred activities.'
        when personalize and strength>0 then 'Similar to activities you interacted with.'
        when personalize and has_distance and km<=pref.radius_km then 'Within your preferred distance.'
        when personalize and fits_day then 'Fits your preferred days.'
        when personalize and cost_inr<=pref.budget then 'Within your preferred budget.'
        else 'Upcoming with space to join.' end as reason
      from signals s cross join public.discovery_weights w
    ), diversified as (
      select scored.*,
        base_score - .055 * (row_number() over(partition by category order by base_score desc,starts_at,id)-1)
                   - .08 * (row_number() over(partition by host_id order by base_score desc,starts_at,id)-1) as priority
      from scored
    )
    select coalesce(jsonb_agg(jsonb_build_object('id',id,'score',base_score,'reason',reason,'v',row_version) order by priority desc,starts_at,id),'[]') into ranking from diversified;
    update public.discovery_snapshots set ranked=ranking where id=sid and user_id=actor;
  else
    sid := (after_cursor->>'snapshot')::uuid;
    skip_count := (after_cursor->>'offset')::int;
    select ranked into ranking from public.discovery_snapshots where id=sid and user_id=actor and filters=options and created_at>now()-interval '15 minutes';
    if ranking is null or skip_count is null or skip_count<0 then raise exception 'Refresh this discovery feed'; end if;
  end if;
  -- Snapshot freezes order only. Recheck current eligibility before returning any data.
  with eligible as materialized (
    select n,a.*,public.available_spots(a) as spots,entry->>'reason' as reason,(entry->>'score')::float8 as score
    from jsonb_array_elements(ranking) with ordinality r(entry,n)
    join public.activities a on a.id=(entry->>'id')::uuid
    where n>skip_count and entry->>'v'=a.xmin::text and a.state='open' and a.host_id<>actor and a.starts_at>now() and public.available_spots(a)>=greatest(1,(options->>'spots')::int)
      and not exists(select 1 from public.participations where user_id=actor and activity_id=a.id and status in ('accepted','pending'))
      and not exists(select 1 from public.discovery_interactions where user_id=actor and activity_id=a.id and kind='dismiss')
      and (not options ? 'category' or a.category=options->>'category')
      and (not options ? 'budget' or a.cost_inr<=(options->>'budget')::numeric)
      and (not options ? 'from' or a.starts_at>=(options->>'from')::timestamptz)
      and (not options ? 'until' or a.starts_at<(options->>'until')::timestamptz)
      and (not options ? 'mode' or a.join_mode=options->>'mode')
      and (not options ? 'search' or position(lower(options->>'search') in lower(a.title||' '||a.area))>0)
    order by n limit page_size+1
  ), page as (select * from eligible order by n limit page_size)
  select jsonb_build_object('items',coalesce(jsonb_agg((to_jsonb(page)-'n'-'spots')||jsonb_build_object('available_spots',spots,'participations','[]'::jsonb) order by n),'[]'),
    'next',case when (select count(*) from eligible)>page_size then jsonb_build_object('snapshot',sid,'offset',max(n)) end) into result from page;
  return result;
end $$;
revoke all on function public.recommend_activities(jsonb,jsonb,int) from public,anon;
grant execute on function public.recommend_activities(jsonb,jsonb,int) to authenticated;
commit;
