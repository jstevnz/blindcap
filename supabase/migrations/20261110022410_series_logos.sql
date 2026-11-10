-- Optional private series branding; existing events, history and profile photos are untouched.
alter table public.bourbon_series add column logo_path text;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('blindcap-series-logos','blindcap-series-logos',false,1048576,array['image/png']);
