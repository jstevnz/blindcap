-- A confirmed event deletion removes its edition link atomically, keeping the series and other years.
alter table public.bourbon_editions drop constraint bourbon_editions_event_id_fkey;
alter table public.bourbon_editions add constraint bourbon_editions_event_id_fkey
 foreign key(event_id) references public.bourbon_events(id) on delete cascade;
-- Imported historical years have no event row; delete only the named, reviewed edition.
create function public.delete_bourbon_historical_edition(p_id uuid,p_series uuid,p_actor uuid,p_revision integer,p_year integer,p_title text)
returns boolean language plpgsql security invoker set search_path='' as $$
declare affected integer;
begin
 delete from public.bourbon_editions e where e.id=p_id and e.series_id=p_series and e.event_id is null and e.revision=p_revision and e.year=p_year
 and exists(select 1 from public.bourbon_series s join public.bourbon_profiles p on p.id=p_actor where s.id=e.series_id and s.title=p_title and p.status='active' and (p.role='owner' or s.owner_id=p_actor));
 get diagnostics affected=row_count;return affected=1;
end $$;
revoke all on function public.delete_bourbon_historical_edition(uuid,uuid,uuid,integer,integer,text) from public,anon,authenticated;
grant execute on function public.delete_bourbon_historical_edition(uuid,uuid,uuid,integer,integer,text) to service_role;
