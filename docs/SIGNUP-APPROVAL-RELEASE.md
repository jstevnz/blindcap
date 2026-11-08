# Signup and administrator approval — production review

The owner explicitly approved this migration and deployment on November 8, 2026. All 105 automated tests, app/backend type checks and the optimized Next.js build passed before release. The independent blank-event-name change was already published in commit `490fe4c95e1f7fa7e61d5367fa950884a1d50537`. This document records the approved changes and rollout procedure.

## Resulting experience

- The new-event name starts empty. Hosts enter **Name a new event**, select the number of tasters/bottles (2–16), then create the event.
- **Sign up** on Home opens a public profile form. Full name, display name, username, email and password are required. Phone, city/state and tasting notes are optional.
- Signup creates a **pending** account. Email verification proves address ownership but does not approve membership. Verified pending users can sign in and edit only their own profiles.
- A new-signup notification goes to the stored active community-owner address, your saved administrator address. The notification links to **Signup reviews**; it does not contain an approval token or grant access by clicking the email link.
- Only the community owner can review private applicant details, approve a verified applicant, or confirm deletion of a pending signup. Approval enables member search, event invitations and hosting.
- Host searches show only approved profiles and their public display name, username and tasting notes. Private full name, phone and city/state remain visible only to the applicant and reviewing administrator.
- Personal invitation links remain available, but new invited profiles also require approval.

## Exact production migration

Apply [`20261108214337_membership_applications.sql`](../supabase/migrations/20261108214337_membership_applications.sql):

1. Add private full-name/phone/location fields and signup-source, approval, proven guest-identity and notification-status fields to `bourbon_profiles`.
2. Mark existing active profiles as already approved. Existing account IDs, passwords, role/status values, events, bottles, ballots and invitation records are preserved. No event is deleted or rewritten.
3. Grant **USAGE** on the Auth schema and **SELECT/DELETE** on `auth.users` to the privileged `service_role` only. This is the material permission change requiring review. Browser `anon` and `authenticated` roles receive no new access. The service key stays exclusively inside the Supabase backend.
4. Add service-only functions for listing pending applications and reviewing them. Both check the acting account’s stored active-owner role. Approval checks the target’s pending status, current username and verified email. It records who approved and when, and transfers a proven guest seat safely.
5. Pending-signup deletion removes only a pending member profile and its sign-in identity, related unused membership invitations and sessions. It refuses owner profiles, approved profiles and accounts with event ownership or seat records. Concurrent approval/deletion is serialized by a row lock.
6. Replace the legacy invitation-activation function so it can only recognize an already active, approved account. Opening an invitation or verifying an email can no longer activate pending membership automatically.

## Deployment and email behavior

After migration approval, deploy the updated `bourbon-api`, publish the source to `jstevnz/blindcap`, and deploy that exact commit to Vercel Production at `https://blindcap.net`. No new subscription, paid plan or email credential is needed. The existing server-only Resend key sends verification and administrator notifications from `invitations@blindcap.net`.

Owner notifications are tracked and use a stable idempotency key. A failed notification leaves the application visible in review and is retried after applicant verification or when the owner opens pending reviews. Verification-email failure also preserves the application and allows requesting another email sign-in link. Signup retries never reset an existing password or profile.

Public signup has a hidden bot field, per-source and per-email limits, a 25-new-accounts/day cap, and an hourly cap. Public signup-verification emails are capped at 50/day; account email sends are capped at 75/day. These guardrails bound free-tier usage; they do not guarantee protection against every form of abuse.

## Tests and remaining live checks

All 105 tests pass. New tests cover owner-only review, email verification without automatic activation, legacy-invitation bypass prevention, private contact fields, preserved existing memberships/events, pending-only deletion with session cleanup, failed notification retention, fixed recipient selection, signup retry credential protection, and denial of all event APIs to pending profiles. Existing tournament, guest invitation, history and event-deletion tests continue to pass.

After approval and deployment, verify public signup and pending profile editing through the production API, then approve a controlled test applicant and verify hosting/search eligibility. Verify pending deletion without touching a real member or event. Use one clearly labeled temporary signup to check provider acceptance of the administrator notification, then remove its test records. This will send a test notification to the configured owner address. Actual inbox receipt can then be confirmed by the owner.

Frontend rollback can restore the preceding deployment. Preserve newly created application records; do not drop fields or delete real applicants as an automatic rollback. If rolling back the backend, keep the approval gate in the database so older invitation code cannot silently admit pending applicants.
