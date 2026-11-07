-- Run once in the intended Supabase project. No browser role can read raw event state.
create table public.bourbon_events (
  id uuid primary key,
  owner_id uuid not null references auth.users(id),
  member_emails text[] not null default '{}',
  revision integer not null default 0,
  state jsonb not null,
  created_at timestamptz not null default now(),
  constraint matching_state check (state->>'id'=id::text and (state->>'revision')::integer=revision and state->>'ownerId'=owner_id::text)
);
alter table public.bourbon_events enable row level security;
revoke all on public.bourbon_events from anon, authenticated;
grant select, insert, update on public.bourbon_events to service_role;
-- Compare-and-swap makes ballot submissions, closing, advancement and reveal atomic.
create function public.save_bourbon_event(p_id uuid,p_revision integer,p_state jsonb,p_member_emails text[])
returns boolean language plpgsql security invoker set search_path='' as $$
declare affected integer;
begin
 update public.bourbon_events set state=p_state,revision=p_revision+1,member_emails=p_member_emails
 where id=p_id and revision=p_revision;
 get diagnostics affected=row_count;
 return affected=1;
end;
$$;
revoke all on function public.save_bourbon_event(uuid,integer,jsonb,text[]) from public,anon,authenticated;
grant execute on function public.save_bourbon_event(uuid,integer,jsonb,text[]) to service_role;
