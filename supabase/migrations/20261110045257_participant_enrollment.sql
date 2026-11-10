-- Reserved seats are private. Matching uses an approved profile's verified account email.
create table public.bourbon_reserved_participants (
 event_id uuid not null references public.bourbon_events(id) on delete cascade,
 participant_id uuid not null,email text not null check(email=lower(email)),
 first_name text not null,last_name text not null,
 invited_at timestamptz,registration_sent_at timestamptz,
 linked_user_id uuid references public.bourbon_profiles(id),
 primary key(event_id,participant_id),unique(event_id,email)
);
create index bourbon_reserved_email_idx on public.bourbon_reserved_participants(email);
alter table public.bourbon_reserved_participants enable row level security;
revoke all on public.bourbon_reserved_participants from public,anon,authenticated;
grant select,insert,update,delete on public.bourbon_reserved_participants to service_role;
alter table public.bourbon_member_invites add column email_sent_at timestamptz;
grant delete on public.bourbon_guest_access to service_role;

create function public.save_bourbon_enrollment_event(p_id uuid,p_revision integer,p_state jsonb,p_member_emails text[])
returns boolean language plpgsql security invoker set search_path='' as $$
declare participant jsonb; account uuid;
begin
 if not public.save_bourbon_community_event(p_id,p_revision,p_state,p_member_emails) then return false; end if;
 delete from public.bourbon_member_invites i where i.event_id=p_id and not exists(select 1 from jsonb_array_elements(p_state->'participants') p where p->>'id'=i.participant_id::text and p->>'accountId'=i.invitee_id::text);
 delete from public.bourbon_guest_access g where g.event_id=p_id and not exists(select 1 from jsonb_array_elements(p_state->'participants') p where p->>'id'=g.participant_id::text);
 delete from public.bourbon_reserved_participants r where r.event_id=p_id and not exists(select 1 from jsonb_array_elements(p_state->'participants') p where p->>'id'=r.participant_id::text and p->>'email'=r.email);
 for participant in select value from jsonb_array_elements(p_state->'participants') loop
  if participant->>'accountId' is null then
   insert into public.bourbon_reserved_participants(event_id,participant_id,email,first_name,last_name,invited_at)
   values(p_id,(participant->>'id')::uuid,participant->>'email',participant->>'firstName',participant->>'lastName',case when coalesce((p_state->>'rosterInvited')::boolean,false) then now() else null end)
   on conflict(event_id,participant_id) do update set first_name=excluded.first_name,last_name=excluded.last_name,invited_at=coalesce(public.bourbon_reserved_participants.invited_at,excluded.invited_at);
  elsif coalesce((p_state->>'rosterInvited')::boolean,false) then
   account=(participant->>'accountId')::uuid;
   insert into public.bourbon_member_invites(event_id,participant_id,invitee_id,invited_by,status)
   values(p_id,(participant->>'id')::uuid,account,(p_state->>'ownerId')::uuid,'pending') on conflict(event_id,participant_id) do nothing;
  end if;
 end loop;
 return true;
end $$;

create function public.link_bourbon_reserved_participants(p_user uuid) returns integer
language plpgsql security invoker set search_path='' as $$
declare profile public.bourbon_profiles; reservation public.bourbon_reserved_participants; event public.bourbon_events; pos integer; nextstate jsonb; amount integer=0; name text;
begin
 select * into profile from public.bourbon_profiles where id=p_user and status='active';
 if not found then return 0; end if;
 name=coalesce(nullif(trim(coalesce(profile.first_name,'')||' '||coalesce(profile.last_name,'')),''),nullif(profile.full_name,''),profile.display_name);
 for reservation in select * from public.bourbon_reserved_participants where email=profile.email and invited_at is not null and linked_user_id is null order by event_id loop
  select * into event from public.bourbon_events where id=reservation.event_id for update;
  if not found or event.state->>'phase'<>'setup' then continue; end if;
  if not exists(select 1 from public.bourbon_reserved_participants where event_id=reservation.event_id and participant_id=reservation.participant_id and linked_user_id is null) then continue; end if;
  if exists(select 1 from jsonb_array_elements(event.state->'participants') p where p->>'accountId'=p_user::text and p->>'id'<>reservation.participant_id::text) then continue; end if;
  select ordinality::integer-1 into pos from jsonb_array_elements(event.state->'participants') with ordinality where value->>'id'=reservation.participant_id::text and value->>'email'=profile.email;
  if pos is null then continue; end if;
  nextstate=jsonb_set(event.state,array['participants',pos::text],(event.state->'participants'->pos)||jsonb_build_object('accountId',p_user::text,'name',name,'firstName',coalesce(profile.first_name,split_part(name,' ',1)),'lastName',coalesce(profile.last_name,substr(name,length(split_part(name,' ',1))+2))));
  nextstate=jsonb_set(nextstate,'{revision}',to_jsonb(event.revision+1));
  update public.bourbon_events set state=nextstate,revision=revision+1 where id=event.id;
  insert into public.bourbon_member_invites(event_id,participant_id,invitee_id,invited_by,status) values(event.id,reservation.participant_id,p_user,event.owner_id,'pending') on conflict(event_id,participant_id) do nothing;
  update public.bourbon_reserved_participants set linked_user_id=p_user where event_id=event.id and participant_id=reservation.participant_id;
  amount=amount+1;
 end loop;return amount;
end $$;
revoke all on function public.save_bourbon_enrollment_event(uuid,integer,jsonb,text[]),public.link_bourbon_reserved_participants(uuid) from public,anon,authenticated;
grant execute on function public.save_bourbon_enrollment_event(uuid,integer,jsonb,text[]),public.link_bourbon_reserved_participants(uuid) to service_role;
