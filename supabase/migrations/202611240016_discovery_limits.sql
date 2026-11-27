begin;
create table sidequest_private.feed_windows (
  user_id uuid primary key references auth.users on delete cascade,
  started_at timestamptz not null, requests int not null
);
create function sidequest_private.limit_feed() returns trigger language plpgsql security definer set search_path='' as $$
declare hits int;
begin
  insert into sidequest_private.feed_windows as w values(new.user_id,clock_timestamp(),1)
  on conflict(user_id) do update set
    started_at=case when w.started_at<now()-interval '1 minute' then now() else w.started_at end,
    requests=case when w.started_at<now()-interval '1 minute' then 1 else w.requests+1 end
  returning requests into hits;
  if hits>60 then raise exception 'Please wait a minute before refreshing again';end if;
  return new;
end $$;
create trigger limit_feed before insert on public.discovery_snapshots for each row execute function sidequest_private.limit_feed();
create function sidequest_private.prune_discovery() returns void language sql security definer set search_path='' as $$
  delete from public.discovery_snapshots where created_at<now()-interval '15 minutes';
  delete from public.discovery_interactions where kind not in ('save','dismiss') and happened_at<now()-interval '180 days';
  delete from sidequest_private.feed_windows where started_at<now()-interval '1 day';
  update sidequest_private.push_deliveries d set state='failed',lease=null from public.activity_alerts a
    where d.alert_id=a.id and d.state='pending' and (a.created_at<now()-interval '1 day' or (d.attempts>=12 and d.next_attempt<now()));
$$;
revoke all on function sidequest_private.prune_discovery() from public,anon,authenticated;
do $$ begin
 if exists(select 1 from pg_extension where extname='pg_cron') then
   perform cron.schedule('sidequest-retention','15 * * * *','select sidequest_private.prune_discovery()');
 end if;
end $$;
commit;
