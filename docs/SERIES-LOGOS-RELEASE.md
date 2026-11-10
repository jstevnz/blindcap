# Optional series logos

Series creation accepts an optional PNG/JPEG/WebP logo. Browser resizing preserves aspect ratio and transparency, caps dimensions at 1000px, and converts to a PNG of at most 1MB. Failed uploads leave the created series accessible and retryable without duplicating it.

The series creator and site owner can replace or remove the shared logo. Participants and annual coordinators without series ownership cannot change series branding. Series lists, the history workspace and linked annual event screens use the current series logo. Storage is private; readers receive a one-hour signed URL only after existing event/series authorization. Upload paths are server-generated and series-scoped. PNG signature/size are verified before committing the new path; compare-and-swap prevents stale replacements, and invalid uploads preserve the previous logo. Superseded saved files are removed after a successful change.

The additive migration adds only bourbon_series.logo_path and the private constrained blindcap-series-logos bucket. Existing event JSON, ballots, history and profile photos are untouched. No new browser database or storage policies are granted.

Validation: production build, frontend/backend typechecks, full test suite, series manager authorization, generated path scoping, PNG validation, size limit and migration rehearsal. Publish migration, extended backend, then exact tested GitHub commit to Blindcap production. Do not select or upload a logo for the user without their choice.
