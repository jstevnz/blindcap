-- Existing full_name values are preserved; separate fields are filled when members save.
alter table public.bourbon_profiles add column first_name text check(first_name is null or length(first_name)<=100);
alter table public.bourbon_profiles add column last_name text check(last_name is null or length(last_name)<=100);
