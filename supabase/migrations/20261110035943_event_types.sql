-- All existing series use the sole supported event format. No ballots or event JSON change.
alter table public.bourbon_series add column event_type text not null default 'bourbon-tasting' check(event_type in ('bourbon-tasting'));
