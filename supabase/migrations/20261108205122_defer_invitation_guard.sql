-- GoTrue inserts a user and then attaches app metadata in the same transaction.
-- Check the final stored row at commit, never user-supplied user_metadata.
create or replace function public.blindcap_invite_only_user_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
declare metadata jsonb;
begin
 select raw_app_meta_data into metadata from auth.users where id=new.id;
 if not found then return new; end if;
 if coalesce(metadata->>'blindcap_managed','false')<>'true' then
  raise exception 'Blindcap account creation requires a private invitation.';
 end if;
 return new;
end $$;
drop trigger blindcap_invite_only_user_guard on auth.users;
create constraint trigger blindcap_invite_only_user_guard
 after insert on auth.users deferrable initially deferred
 for each row execute function public.blindcap_invite_only_user_guard();
