-- Additive series/history release. Existing event JSON and ballots remain untouched.
create table public.bourbon_series (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.bourbon_profiles(id),
 title text not null check(length(title) between 1 and 100),
 winner_award text not null default 'Yorktown Tumbler' check(length(winner_award) between 1 and 80),
 swill_award text not null default 'Swill Award' check(length(swill_award) between 1 and 80),
 created_at timestamptz not null default now()
);
create table public.bourbon_editions (
 id uuid primary key default gen_random_uuid(),series_id uuid not null references public.bourbon_series(id) on delete cascade,
 year integer not null check(year between 1900 and 2200),
 event_id uuid unique references public.bourbon_events(id) on delete restrict,
 historical_entries jsonb, revision integer not null default 0,
 check ((event_id is not null and historical_entries is null) or (event_id is null and jsonb_typeof(historical_entries)='array')),
 unique(series_id,year)
);
create table public.bourbon_series_members (
 series_id uuid not null references public.bourbon_series(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 primary key(series_id,user_id)
);
create table public.bourbon_series_people (
 id uuid primary key default gen_random_uuid(), series_id uuid not null references public.bourbon_series(id) on delete cascade,
 name text not null check(length(name) between 1 and 100),
 name_key text generated always as (lower(name)) stored,
 profile_id uuid references public.bourbon_profiles(id), unique(series_id,name_key)
);
create unique index bourbon_series_person_profile on public.bourbon_series_people(series_id,profile_id) where profile_id is not null;
create index bourbon_editions_series_idx on public.bourbon_editions(series_id);
create index bourbon_series_members_user_idx on public.bourbon_series_members(user_id);
alter table public.bourbon_profiles add column avatar_path text;
alter table public.bourbon_series enable row level security;
alter table public.bourbon_editions enable row level security;
alter table public.bourbon_series_members enable row level security;
alter table public.bourbon_series_people enable row level security;
revoke all on public.bourbon_series,public.bourbon_editions,public.bourbon_series_members,public.bourbon_series_people from public,anon,authenticated;
grant select,insert,update,delete on public.bourbon_series,public.bourbon_editions,public.bourbon_series_members,public.bourbon_series_people to service_role;
-- Only the privileged backend calls this. The event creator remains its assigned coordinator.
create function public.bourbon_create_edition(p_series uuid,p_year integer,p_event jsonb,p_actor uuid)
returns uuid language plpgsql security invoker set search_path='' as $$
declare edition uuid;
begin
 if not exists(select 1 from public.bourbon_profiles p join public.bourbon_series s on s.id=p_series where p.id=p_actor and p.status='active' and (s.owner_id=p_actor or p.role='owner')) then raise exception 'Series permission required'; end if;
 if not exists(select 1 from public.bourbon_profiles where id=(p_event->>'ownerId')::uuid and status='active') then raise exception 'Active coordinator required'; end if;
 insert into public.bourbon_events(id,owner_id,state) values((p_event->>'id')::uuid,(p_event->>'ownerId')::uuid,p_event);
 insert into public.bourbon_editions(series_id,year,event_id) values(p_series,p_year,(p_event->>'id')::uuid) returning id into edition;
 insert into public.bourbon_series_members(series_id,user_id) values(p_series,(p_event->>'ownerId')::uuid) on conflict do nothing;
 return edition;
end $$;
revoke all on function public.bourbon_create_edition(uuid,integer,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.bourbon_create_edition(uuid,integer,jsonb,uuid) to service_role;
-- Persist history access as soon as a member is invited in a locked draw.
create function public.bourbon_series_invite_access() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.state->>'phase'<>'setup' then
 insert into public.bourbon_series_members(series_id,user_id)
 select ed.series_id,(p->>'accountId')::uuid from public.bourbon_editions ed,jsonb_array_elements(new.state->'participants') p
 where ed.event_id=new.id and p->>'accountId' is not null on conflict do nothing;
 end if;return new;
end $$;
revoke all on function public.bourbon_series_invite_access() from public,anon,authenticated;
create trigger bourbon_series_invite_access after update of state on public.bourbon_events for each row execute function public.bourbon_series_invite_access();
-- Private photos: no anonymous listing, reads or writes. Backend issues short-lived URLs.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('blindcap-avatars','blindcap-avatars',false,524288,array['image/jpeg','image/png','image/webp']);
