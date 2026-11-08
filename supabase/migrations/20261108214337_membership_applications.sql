alter table public.bourbon_profiles
 add column full_name text not null default '' check(length(full_name)<=100),
 add column phone text not null default '' check(length(phone)<=30),
 add column location text not null default '' check(length(location)<=120),
 add column signup_source text not null default 'invitation' check(signup_source in ('invitation','application')),
 add column approved_at timestamptz,
 add column approved_by uuid references auth.users(id),
 add column claim_guest_id uuid references auth.users(id),
 add column admin_notified_at timestamptz;
-- Preserve every existing active member. New accounts default to pending, without approval.
update public.bourbon_profiles set approved_at=created_at where status='active';
-- Service-only review functions must inspect verification and remove rejected pending identities.
-- Browser roles receive no new grants.
grant usage on schema auth to service_role;
grant select,delete on auth.users to service_role;
create function public.pending_bourbon_members(p_actor uuid) returns jsonb
language sql security invoker set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(candidate)),'[]'::jsonb) from (
 select p.id,p.username,p.display_name,p.full_name,p.email,p.phone,p.location,p.bio,p.created_at,p.signup_source,p.admin_notified_at,
 u.email_confirmed_at is not null as verified
 from public.bourbon_profiles p join auth.users u on u.id=p.id
 where p.status='pending' and p.role='member'
 and exists(select 1 from public.bourbon_profiles owner where owner.id=p_actor and owner.status='active' and owner.role='owner')
 order by p.created_at limit 100
 ) candidate;
$$;
create function public.review_bourbon_member(p_actor uuid,p_target uuid,p_decision text,p_username text) returns boolean
language plpgsql security invoker set search_path='' as $$
declare candidate public.bourbon_profiles; guest_id uuid;
begin
 if not exists(select 1 from public.bourbon_profiles where id=p_actor and role='owner' and status='active') then return false; end if;
 select * into candidate from public.bourbon_profiles where id=p_target and status='pending' and role='member' and username=p_username for update;
 if not found then return false; end if;
 if p_decision='approve' then
  if not exists(select 1 from auth.users where id=p_target and lower(email)=candidate.email and email_confirmed_at is not null) then raise exception 'The applicant must verify their email before approval.'; end if;
  guest_id=candidate.claim_guest_id;
  if guest_id is null then select claim_guest_id into guest_id from public.bourbon_community_invites where reserved_user_id=p_target and claim_guest_id is not null order by created_at desc limit 1; end if;
  if guest_id is not null and exists(select 1 from public.bourbon_guest_access oldseat join public.bourbon_guest_access newseat on newseat.event_id=oldseat.event_id where oldseat.auth_user_id=guest_id and newseat.auth_user_id=p_target and newseat.participant_id<>oldseat.participant_id) then raise exception 'This account already has another seat in the guest event.'; end if;
  update public.bourbon_profiles set status='active',approved_at=now(),approved_by=p_actor,claim_guest_id=null where id=p_target;
  if guest_id is not null then update public.bourbon_guest_access set auth_user_id=p_target where auth_user_id=guest_id; end if;
  update public.bourbon_community_invites set redeemed_at=now() where reserved_user_id=p_target and redeemed_at is null;
  return true;
 elsif p_decision='delete' then
  if exists(select 1 from public.bourbon_events where owner_id=p_target) or exists(select 1 from public.bourbon_guest_access where auth_user_id=p_target) or exists(select 1 from public.bourbon_member_invites where invitee_id=p_target or invited_by=p_target) then raise exception 'This account has event records and cannot be deleted as a pending signup.'; end if;
  delete from public.bourbon_community_invites where reserved_user_id=p_target or claim_guest_id=p_target;
  delete from public.bourbon_profiles where id=p_target;
  delete from auth.users where id=p_target;
  return true;
 end if;
 return false;
end $$;
-- Legacy invitation redemption may no longer grant membership without an owner decision.
create or replace function public.bourbon_activate_member(p_user uuid,p_email text) returns boolean
language sql security invoker set search_path='' as $$
 select exists(select 1 from public.bourbon_profiles where id=p_user and email=lower(p_email) and status='active' and approved_at is not null);
$$;
revoke all on function public.pending_bourbon_members(uuid),public.review_bourbon_member(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.pending_bourbon_members(uuid),public.review_bourbon_member(uuid,uuid,text,text) to service_role;
