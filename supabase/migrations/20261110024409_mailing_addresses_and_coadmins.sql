-- Private address fields remain behind the existing backend-only profile permissions.
alter table public.bourbon_profiles add column mailing_address jsonb not null default '{}'::jsonb check(jsonb_typeof(mailing_address)='object');
alter table public.bourbon_events add column admin_ids uuid[] not null default '{}';
create index bourbon_events_admin_ids_idx on public.bourbon_events using gin(admin_ids);
-- Keep the lookup index in the same transaction as the existing event compare-and-swap.
create function public.bourbon_sync_event_admins() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 new.admin_ids=array(select distinct value::uuid from jsonb_array_elements_text(coalesce(new.state->'adminIds','[]'::jsonb)));
 return new;
end $$;
revoke all on function public.bourbon_sync_event_admins() from public,anon,authenticated;
grant execute on function public.bourbon_sync_event_admins() to service_role;
create trigger bourbon_sync_event_admins before insert or update of state on public.bourbon_events for each row execute function public.bourbon_sync_event_admins();
