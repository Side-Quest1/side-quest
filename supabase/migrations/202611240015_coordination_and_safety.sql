begin;
alter table public.account_profiles add column bio text not null default '' check(length(bio)<=300),
  add column avatar text not null default '🌿' check(length(avatar)<=8);
grant insert(bio,avatar),update(bio,avatar) on public.account_profiles to authenticated;
alter table public.activity_alerts add column read_at timestamptz;
grant update(read_at) on public.activity_alerts to authenticated;
create policy mark_alert_read on public.activity_alerts for update to authenticated using(recipient=auth.uid()) with check(recipient=auth.uid());
create index unread_activity_alerts on public.activity_alerts(recipient,activity_id) where read_at is null;
create function sidequest_private.coordination_alert() returns trigger language plpgsql security definer set search_path='' as $$
declare q uuid; author uuid; content text;
begin
  if tg_table_name='activity_messages' then q:=new.activity_id;author:=new.sender;content:='New activity chat message';
  else q:=new.id;author:=new.host_id;content:='The host updated the activity';end if;
  insert into public.activity_alerts(recipient,activity_id,body)
    select p.user_id,q,content from public.participations p
    left join public.account_profiles f on f.user_id=p.user_id
    where p.activity_id=q and p.status='accepted' and p.user_id<>author and coalesce(f.activity_alerts,true)
      and not exists(select 1 from public.user_blocks b where (b.blocker=p.user_id and b.blocked=author) or (b.blocker=author and b.blocked=p.user_id))
      and not exists(select 1 from public.activity_alerts n where n.recipient=p.user_id and n.activity_id=q and n.body=content and n.read_at is null);
  return new;
end $$;
create trigger chat_notice after insert on public.activity_messages for each row execute function sidequest_private.coordination_alert();
create trigger edit_notice after update of title,starts_at,area,capacity on public.activities for each row
  when ((old.title,old.starts_at,old.area,old.capacity) is distinct from (new.title,new.starts_at,new.area,new.capacity))
  execute function sidequest_private.coordination_alert();
create function public.my_age_status() returns int language sql stable security definer set search_path='' as $$
  select sidequest_private.cohort(auth.uid())
$$;
create table sidequest_private.moderators(user_id uuid primary key references auth.users on delete cascade);
create function public.review_report(report uuid, decision text) returns void language plpgsql security definer set search_path='' as $$
declare r public.safety_reports;
begin
  if not exists(select 1 from sidequest_private.moderators where user_id=auth.uid()) then raise exception 'Moderator required';end if;
  select * into r from public.safety_reports where id=report for update;
  if r.id is null or r.state='resolved' or decision not in ('reviewing','resolve','cancel_activity') or decision is null then raise exception 'Invalid review';end if;
  if decision='cancel_activity' then
    update public.activities set state='cancelled' where id=r.activity_id and state='open';
    update public.participations set status='rejected' where activity_id=r.activity_id and status='pending';
  end if;
  update public.safety_reports set state=case when decision='reviewing' then 'reviewing' else 'resolved' end where id=r.id;
  insert into sidequest_private.moderation_actions(report_id,moderator_id,action) values(r.id,auth.uid(),decision);
end $$;
create function sidequest_private.is_moderator() returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from sidequest_private.moderators where user_id=auth.uid())
$$;
create policy moderator_reads on public.safety_reports for select to authenticated using(sidequest_private.is_moderator());
revoke all on function public.my_age_status(),public.review_report(uuid,text) from public,anon;
grant execute on function public.my_age_status(),public.review_report(uuid,text) to authenticated;
commit;
