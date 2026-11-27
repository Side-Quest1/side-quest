begin;
create function public.edit_activity(q uuid, new_title text, new_description text, new_area text, new_capacity integer,
 new_start timestamptz, new_end timestamptz, new_category text, new_cost numeric, new_mode text)
returns void language plpgsql security definer set search_path='' as $$
declare a public.activities;
begin
 select * into a from public.activities where id=q for update;
 if a.id is null or auth.uid() is distinct from a.host_id or sidequest_private.cohort(auth.uid()) is null then
   raise exception 'Host required';
 end if;
 if a.state<>'open' or a.starts_at<=now() or new_start<=now() then raise exception 'Activity can no longer be rescheduled'; end if;
 if new_capacity < (select count(*) from public.participations where activity_id=q and status='accepted') then
   raise exception 'Capacity is below current membership';
 end if;
 update public.activities set title=new_title,description=new_description,area=new_area,capacity=new_capacity,
 starts_at=new_start,ends_at=new_end,category=new_category,cost_inr=new_cost,join_mode=new_mode where id=q;
end $$;
revoke all on function public.edit_activity(uuid,text,text,text,integer,timestamptz,timestamptz,text,numeric,text) from public,anon;
grant execute on function public.edit_activity(uuid,text,text,text,integer,timestamptz,timestamptz,text,numeric,text) to authenticated;
commit;
