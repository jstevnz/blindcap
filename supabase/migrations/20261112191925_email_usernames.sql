-- Keep existing profile IDs and relationships while making the login name the email.
alter table public.bourbon_profiles
  drop constraint bourbon_profiles_username_check;

update public.bourbon_profiles
set username = email
where username is distinct from email;

alter table public.bourbon_profiles
  add constraint bourbon_profiles_username_matches_email check (username = email);
