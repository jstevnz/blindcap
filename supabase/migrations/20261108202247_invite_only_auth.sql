-- Only our server creates accounts after validating a private community or guest invitation.
-- raw_app_meta_data is service-managed; user_metadata is deliberately not trusted.
create function public.blindcap_invite_only_user_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if coalesce(new.raw_app_meta_data->>'blindcap_managed','false')<>'true' then
  raise exception 'Blindcap account creation requires a private invitation.';
 end if;
 return new;
end $$;
revoke all on function public.blindcap_invite_only_user_guard() from public,anon,authenticated;
grant execute on function public.blindcap_invite_only_user_guard() to supabase_auth_admin;
create trigger blindcap_invite_only_user_guard before insert on auth.users for each row execute function public.blindcap_invite_only_user_guard();
