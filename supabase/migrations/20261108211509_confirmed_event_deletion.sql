-- Event removal is called only by the authenticated backend, one confirmed ID at a time.
-- A fresh database membership check enforces host ownership or community ownership.
-- Revision/title matching prevents a stale confirmation from deleting a changed event.
grant delete on public.bourbon_events to service_role;
create function public.delete_bourbon_event(p_id uuid,p_actor uuid,p_revision integer,p_title text)
returns boolean language plpgsql security invoker set search_path='' as $$
declare affected integer;
begin
 delete from public.bourbon_events e
 where e.id=p_id and e.revision=p_revision and e.state->>'title'=p_title
 and exists(select 1 from public.bourbon_profiles p where p.id=p_actor and p.status='active' and (e.owner_id=p_actor or p.role='owner'));
 get diagnostics affected=row_count;
 return affected=1;
end $$;
revoke all on function public.delete_bourbon_event(uuid,uuid,integer,text) from public,anon,authenticated;
grant execute on function public.delete_bourbon_event(uuid,uuid,integer,text) to service_role;
