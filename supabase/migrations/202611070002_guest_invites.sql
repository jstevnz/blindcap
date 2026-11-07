create index bourbon_events_owner_idx on public.bourbon_events(owner_id);
create index bourbon_events_members_idx on public.bourbon_events using gin(member_emails);
create table public.bourbon_invites (
 token_hash text primary key,
 event_id uuid not null references public.bourbon_events(id) on delete cascade,
 participant_id uuid not null,
 expires_at timestamptz not null,
 redeemed_at timestamptz,
 unique(event_id,participant_id)
);
create table public.bourbon_guest_access (
 event_id uuid not null references public.bourbon_events(id) on delete cascade,
 participant_id uuid not null,
 auth_user_id uuid not null references auth.users(id),
 primary key(event_id,participant_id)
);
create index bourbon_guest_user_idx on public.bourbon_guest_access(auth_user_id);
alter table public.bourbon_invites enable row level security;
alter table public.bourbon_guest_access enable row level security;
revoke all on public.bourbon_invites,public.bourbon_guest_access from anon,authenticated;
grant select,insert,update on public.bourbon_invites,public.bourbon_guest_access to service_role;
create function public.consume_bourbon_invite(p_hash text)
returns table(event_id uuid,participant_id uuid) language sql security invoker set search_path='' as $$
 update public.bourbon_invites set redeemed_at=now()
 where token_hash=p_hash and redeemed_at is null and expires_at>now()
 returning event_id,participant_id;
$$;
revoke all on function public.consume_bourbon_invite(text) from public,anon,authenticated;
grant execute on function public.consume_bourbon_invite(text) to service_role;
