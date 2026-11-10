# Annual event series, bottle details and optional profile photos

## Scope

- Event series contain one annual edition per year. A series creator/site owner creates annual editions and selects an approved coordinator. The existing event owner/host permission model governs that edition only. A coordinator does not inherit control of the series or other editions.
- Any approved member can create their own series. The site owner can manage all series. One-time events remain available.
- Invited members can read every revealed annual edition in their series before accepting their current seat. Private guest access begins after redeeming their invitation. Live anonymous bottle metadata, unpublished results, ballot details, emails and contact information are excluded from the archive.
- Historical years accept 2–100 named participants, optional bottles/distilleries/proof/placements and exactly one winner and one last-place award. Missing scores are not fabricated. Historical entries are labeled. Historical names can be linked to an approved member to combine award totals and profile achievements.
- Bottle setup adds optional distillery/proof, derives ABV, validates proof >0 and <=200, and hides all metadata in blind taster snapshots.
- Photos are optional. Members add them in Account after email confirmation. The browser crops/resizes to 384px JPEG, removes original metadata and rejects files >10MB; private storage limits files to 512KB. Backend issues uploads only to the caller's fixed path and short-lived read URLs. Pending accounts can manage only their own photo. Initials appear without a photo.

## Database release

`supabase/migrations/20261110014929_event_series_and_photos.sql` adds four backend-only RLS tables, an optional avatar path column, two invoker functions (edition creation and invitation-access trigger), and a private constrained storage bucket. No browser data-table grants, no public photo policies, no Auth-table permissions, no destructive event edits. Existing event state and ballots are unchanged. Annual edition creation is transactional; duplicate years roll back the new event. Linked editions restrict deletion of their live event, preserving the series archive.

Existing events are not assigned invented years automatically. Use “Link existing event” with the correct year. Historical results must be entered by the user from their records.

## Verification

118 automated checks pass, including PostgreSQL migration/privilege rehearsal, atomic duplicate-year rollback, coordinator scoping, invitation history access, unpublished metadata exclusion, historical/profile totals and photo-path authorization. Production build and frontend/backend TypeScript checks pass. React review covers stable list keys, labeled inputs, responsive scrolling tables, disabled submission controls and client-side photo resizing.

## Deployment order and recovery

1. Apply additive migration to the existing Blindcap Supabase project.
2. Publish the authenticated bourbon-api with series/photo modules.
3. Commit tested source and deploy exact GitHub commit to the existing Blindcap Vercel production project.
4. Check live routes, anonymous denial, backend logs and existing event fingerprints; inspect the signed-in UI when a session is available.

If frontend deployment fails, existing frontend remains usable against the extended backend. Roll back frontend/backend code as necessary; leave additive schema in place to preserve any newly entered history or photos. Do not drop tables to roll back a UI release.
