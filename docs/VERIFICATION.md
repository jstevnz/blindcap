# Blindcap verification

The earlier entries below describe their release dates. The private-community release supersedes the original email-only sign-in design and adds username/password accounts. See [Community release and operating guide](COMMUNITY-ROLLOUT.md) for the current model.

Verified November 7, 2026.

- Production deployment READY on Vercel from GitHub commit `378371bb058b4b315f6254df32fcd1a66e44939d`.
- Nine automated scoring, privacy and guest-seat tests passed.
- Next.js production build and TypeScript checks for both app and Edge Function passed. GitHub Actions checks passed.
- Live Supabase rehearsal: 12 guest invitations redeemed; replay rejected; seven normal flights completed; blind award runoff completed; weighted 1–12 standings and reveal checked.
- All 12 ballots submitted concurrently per flight, with conflict retries. Exactly 12 unique ballots survived each group. Early group closure and unauthorized guest host actions were rejected.
- Verified Next.js cookie session → API → live Supabase function → database → sanitized response. Foreign-origin writes rejected.
- On the deployed site, the in-app browser joined a guest seat through a private link and displayed awards, full standings, personal bottle results and private ballot history. Signed out after testing.
- Database checks: anonymous and authenticated browser roles cannot read raw event state or invoke privileged mutation functions. RLS enabled.
- Supabase advisory notices about RLS without policies are expected: browser table privileges are revoked; access is exclusively through the authenticated backend. Password leak checking is not used because the app has no password sign-in.
- Runtime error scan returned no error or fatal records for the tested deployment. No persistent monitoring service was configured.
- Automated rehearsal data and synthetic test identities were removed after testing.

## Owner setup still to verify

Host email delivery and the production email redirect must be tested with the owner’s actual Supabase organization email. This cannot be inferred from successful guest invitation tests. Supabase URL Configuration should use `https://blindcap-jstevnz.vercel.app` as Site URL and allow `https://blindcap-jstevnz.vercel.app/auth/callback`. Guests do not require email delivery.

The Vercel platform sign-in gate was removed with the owner’s explicit approval. The app still enforces host/guest authentication and per-event authorization. Git deployments were created from exact GitHub commits; automatic push-triggered project linking has not been configured.

## Variable-taster update

- Added the approved 2–16 taster formats and proportional stage weights.
- 45 automated tests passed: full tournaments for every count, legacy 12-seat compatibility, ballot thresholds, head-to-head tie runoffs, and rendered winner/Swill cards for all 15 supported field sizes.
- Live Supabase tests passed for event creation at 2, 5 and 16 tasters, rejection of 1 taster, and a complete tied head-to-head final followed by one award runoff and reveal.
- Next.js production build, application type checks and Edge Function type checks passed.
- The fixed twelfth-place assumption in the award display was removed; the Swill card uses the actual last result.
- New event creation asks for taster count and previews the bracket. Existing events retain their stored count or their original twelve-seat format.

## Invitation email update

- 51 automated tests passed, including recipient validation, stable idempotency keys, server-only provider authentication, provider failure handling and delivery-contact privacy.
- Delivery contact changes do not change participant authentication or expose addresses to guests.
- Production build and application/Edge Function type checks passed. Provider calls were mocked; actual inbox delivery still needs an owner-controlled test invitation after the production secret is configured.

## Private community release — November 8, 2026

- 74 automated tests and app/backend type checks passed. Production Next.js build and GitHub Actions checks passed.
- Applied additive community tables and service-only functions. The original four events retained the same revisions and full-state digests; six guest invitations and six guest-seat bindings were preserved.
- Existing verified host became the sole active community owner. All temporary rehearsal members, synthetic guest identities, invitations and event records were removed afterward.
- Deployed backend version 5 with member-hosted events, accepted profile seats, private search, account verification/recovery and own-ballot history.
- Live registration exposed Supabase’s insert-then-metadata order; the deferred constraint-trigger migration checks the final stored account at commit. An actual production guard test rejected user-metadata spoofing. Genuine invited account creation and guest redemption then passed.
- Live temporary three-taster rehearsal passed: a member hosted and tasted, a second member accepted their profile invitation, and a third joined through a guest link. Unaccepted access, guest hosting, guest-link replay, non-host controls and duplicate ranks were rejected. Concurrent ballots, final standings, controlled reveal, own-bottle results and personal ballot history passed.
- Verified production cookie session → Next.js API → Supabase → sanitized response at `https://blindcap.net`, including private history and foreign-origin write rejection. Username/password login passed against actual Supabase Auth.
- Account-email tests deliberately used an invalid provider key and non-deliverable test addresses, confirming that users remain pending and unverified when delivery fails. Only these isolated test accounts were then marked verified for the rehearsal. No emails were sent to real people. Actual verification-email receipt remains an owner-led inbox check.
- Local in-app browser displayed the new community sign-in screen. A full interactive phone rehearsal remains useful before the event.
- Browser roles cannot read profiles or execute privileged membership functions; RLS is enabled on all private tables. RLS-without-policy notices are expected because browser table grants are deliberately revoked. Supabase’s optional [leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) remains disabled in the existing project; application registration requires 12–128 characters.

## Event management update

- Added a dedicated Events page with all-event, in-progress, completed and hosted-by-me filters. Home keeps one Events link instead of expanded lists and tasting journals. Personal tasting history moved to Events.
- Active hosts can delete their own events. The active community owner sees all event summaries and may delete any event. Global summaries expose no bottle identities, participant emails or private ballots, and do not grant unrelated round controls.
- Confirmation uses a native focus-trapped dialog naming the event, creation time and host. Focus defaults to Keep event. Delete permanently explicitly warns that scores, invitations and history are removed for all participants.
- The deletion function rechecks active stored membership and ownership, and matches the confirmed title and revision atomically. Child event access and invitations cascade; user accounts remain. No existing event is deleted by the migration.
- All 90 tests pass, including real local Postgres ownership/cascade tests, backend handler tests for forged actor/role input and stale confirmation, summary privacy, and confirmation rendering. App and backend type checks and the optimized production build pass.

## Public signup with owner approval

- New-event names start blank with a required Name a new event field and the existing 2–16 tasters/bottles selector.
- Signup is public, while full membership stays private and approval-controlled. Pending accounts may verify email, sign in and edit only their own profiles. They cannot use event APIs, search profiles or accept invitations until owner approval.
- Added full name, optional phone/city-state and tasting notes. Private contact fields appear only in self-profile and owner review, never in member search.
- Owner notification targets the stored active community-owner email, never a request-supplied address. Verification and notification failures preserve the pending signup; notification state and provider idempotency support retries.
- Existing active memberships and event records are preserved. Approval is checked in service-only SQL against the owner’s stored role, target’s current pending status and confirmed email. Legacy invitation activation cannot bypass the new policy. Pending deletion cannot delete approved members or event-linked accounts.
- All 105 tests pass, including real local Postgres migration and review tests, notification-recipient/token privacy, signup retry credential protection, failure handling, pending-access denial and unchanged tournament/deletion tests.

### Signup production verification and cleanup refinement

- Production signup accepted the controlled temporary application without an invitation; the email provider accepted verification and one clearly labeled owner notification. The stored profile remained pending, unverified and unapproved.
- Unverified sign-in and owner approval were rejected. Only the controlled fixture’s email verification was then simulated; its production username login and own-profile edits worked while hosting, event access, member search, self-approval and owner review stayed blocked.
- Explicit owner approval through the guarded review function activated the fixture. Production search returned its public fields, not contacts; hosting worked, empty event names failed, and the temporary event was deleted.
- Hosted Supabase did not allow the requested raw Auth DELETE grant. The final backend uses Auth admin.deleteUser after owner checks and a conditional disable, restores a blocked profile after cleanup failure, and refuses event-linked or approved accounts. No additional Auth/profile FK change was applied.
- 109 automated tests, both type checks and the optimized build pass, including cleanup failure recovery and orphaned managed-identity access denial. Extra privileged-account live tests were not performed; a full owner-browser delete walkthrough remains an operational rehearsal.
