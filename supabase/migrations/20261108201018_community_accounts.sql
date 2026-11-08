create table public.bourbon_profiles (
 id uuid primary key references auth.users(id),
 username text not null unique check(username ~ '^[a-z][a-z0-9_]{2,23}$'),
 display_name text not null check(length(display_name) between 1 and 80),
 email text not null unique check(email=lower(email)),
 bio text not null default '' check(length(bio)<=500),
 discoverable boolean not null default true,
 role text not null default 'member' check(role in ('owner','member')),
 status text not null default 'pending' check(status in ('pending','active','suspended')),
 created_at timestamptz not null default now()
);
create table public.bourbon_community_invites (
 id uuid primary key default gen_random_uuid(),
 token_hash text not null unique,
 email text not null unique check(email=lower(email)),
 invited_by uuid not null references public.bourbon_profiles(id),
 expires_at timestamptz not null,
 redeemed_at timestamptz,
 reserved_user_id uuid references auth.users(id),
 claim_guest_id uuid references auth.users(id),
 created_at timestamptz not null default now()
);
create table public.bourbon_member_invites (
 event_id uuid not null references public.bourbon_events(id) on delete cascade,
 participant_id uuid not null,
 invitee_id uuid not null references public.bourbon_profiles(id),
 invited_by uuid not null references auth.users(id),
 status text not null default 'pending' check(status in ('pending','accepted','declined')),
 created_at timestamptz not null default now(),
 primary key(event_id,participant_id)
);
create index bourbon_member_invitee_idx on public.bourbon_member_invites(invitee_id,status);
create table public.bourbon_rate_limits (
 key text not null,bucket timestamptz not null, count integer not null,
 primary key(key,bucket)
);
alter table public.bourbon_profiles enable row level security;
alter table public.bourbon_community_invites enable row level security;
alter table public.bourbon_member_invites enable row level security;
alter table public.bourbon_rate_limits enable row level security;
revoke all on public.bourbon_profiles,public.bourbon_community_invites,public.bourbon_member_invites,public.bourbon_rate_limits from anon,authenticated;
grant select,insert,update,delete on public.bourbon_profiles,public.bourbon_community_invites,public.bourbon_member_invites,public.bourbon_rate_limits to service_role;
-- Existing hosts retain their accounts and events. Only the original host owns community invitations.
insert into public.bourbon_profiles(id,username,display_name,email,role,status)
select distinct u.id,'member_'||left(replace(u.id::text,'-',''),12),left(coalesce(nullif(trim(u.raw_user_meta_data->>'full_name'),''),split_part(u.email,'@',1)),80),lower(u.email),case when u.id='002ee828-fbc2-4df6-ae69-40271a38020d'::uuid then 'owner' else 'member' end,'active'
from auth.users u join public.bourbon_events e on e.owner_id=u.id
where u.email_confirmed_at is not null and u.email not like '%@guests.blindcap.invalid';

create function public.bourbon_take_rate(p_key text,p_seconds integer,p_limit integer) returns boolean
language plpgsql security invoker set search_path='' as $$
declare amount integer; slot timestamptz;
begin
 slot=to_timestamp(floor(extract(epoch from now())/p_seconds)*p_seconds);
 insert into public.bourbon_rate_limits(key,bucket,count) values(p_key,slot,1)
 on conflict(key,bucket) do update set count=public.bourbon_rate_limits.count+1 returning count into amount;
 delete from public.bourbon_rate_limits where bucket<now()-interval '2 days';
 return amount<=p_limit;
end $$;

create function public.bourbon_activate_member(p_user uuid,p_email text) returns boolean
language plpgsql security invoker set search_path='' as $$
declare invitation public.bourbon_community_invites;
begin
 select * into invitation from public.bourbon_community_invites
 where reserved_user_id=p_user and email=lower(p_email) and redeemed_at is null and expires_at>now() for update;
 if not found then return false; end if;
 if invitation.claim_guest_id is not null and exists(
  select 1 from public.bourbon_guest_access oldseat join public.bourbon_guest_access newseat on newseat.event_id=oldseat.event_id
  where oldseat.auth_user_id=invitation.claim_guest_id and newseat.auth_user_id=p_user and newseat.participant_id<>oldseat.participant_id
 ) then raise exception 'This account already has another seat in the guest event.'; end if;
 update public.bourbon_profiles set status='active' where id=p_user and email=lower(p_email) and status='pending';
 if not found then return false; end if;
 if invitation.claim_guest_id is not null then
  update public.bourbon_guest_access set auth_user_id=p_user where auth_user_id=invitation.claim_guest_id;
 end if;
 update public.bourbon_community_invites set redeemed_at=now() where id=invitation.id;
 return true;
end $$;

create function public.bourbon_accept_member_invite(p_event uuid,p_seat uuid,p_user uuid) returns boolean
language plpgsql security invoker set search_path='' as $$
declare invitation public.bourbon_member_invites;
begin
 select * into invitation from public.bourbon_member_invites where event_id=p_event and participant_id=p_seat and invitee_id=p_user and status in ('pending','accepted') for update;
 if not found or not exists(select 1 from public.bourbon_profiles where id=p_user and status='active') then return false; end if;
 if not exists(select 1 from public.bourbon_events e,jsonb_array_elements(e.state->'participants') p where e.id=p_event and p->>'id'=p_seat::text and p->>'accountId'=p_user::text) then return false; end if;
 if exists(select 1 from public.bourbon_guest_access where event_id=p_event and auth_user_id=p_user and participant_id<>p_seat) then raise exception 'You already have another seat in this event.'; end if;
 insert into public.bourbon_guest_access(event_id,participant_id,auth_user_id) values(p_event,p_seat,p_user)
 on conflict(event_id,participant_id) do update set auth_user_id=excluded.auth_user_id;
 update public.bourbon_member_invites set status='accepted' where event_id=p_event and participant_id=p_seat;
 return true;
end $$;

create function public.save_bourbon_community_event(p_id uuid,p_revision integer,p_state jsonb,p_member_emails text[])
returns boolean language plpgsql security invoker set search_path='' as $$
declare affected integer; participant jsonb; account uuid;
begin
 update public.bourbon_events set state=p_state,revision=p_revision+1,member_emails=p_member_emails where id=p_id and revision=p_revision;
 get diagnostics affected=row_count;
 if affected=0 then return false; end if;
 if p_state->>'phase'<>'setup' then
  for participant in select value from jsonb_array_elements(p_state->'participants') loop
   if participant->>'accountId' is not null then
    account=(participant->>'accountId')::uuid;
    insert into public.bourbon_member_invites(event_id,participant_id,invitee_id,invited_by,status)
    values(p_id,(participant->>'id')::uuid,account,(p_state->>'ownerId')::uuid,case when account=(p_state->>'ownerId')::uuid then 'accepted' else 'pending' end)
    on conflict(event_id,participant_id) do nothing;
    if account=(p_state->>'ownerId')::uuid then
     insert into public.bourbon_guest_access(event_id,participant_id,auth_user_id) values(p_id,(participant->>'id')::uuid,account) on conflict(event_id,participant_id) do nothing;
    end if;
   end if;
  end loop;
 end if;
 return true;
end $$;
revoke all on function public.bourbon_take_rate(text,integer,integer),public.bourbon_activate_member(uuid,text),public.bourbon_accept_member_invite(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.bourbon_take_rate(text,integer,integer),public.bourbon_activate_member(uuid,text),public.bourbon_accept_member_invite(uuid,uuid,uuid) to service_role;

revoke all on function public.save_bourbon_community_event(uuid,integer,jsonb,text[]) from public,anon,authenticated;
grant execute on function public.save_bourbon_community_event(uuid,integer,jsonb,text[]) to service_role;
