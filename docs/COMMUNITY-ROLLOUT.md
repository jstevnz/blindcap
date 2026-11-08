# Private community release and operating guide

The owner approved this release on November 8, 2026. The additive migrations below were tested against a local Postgres engine before production rollout. This document records the approved changes, preservation guarantees and live verification procedure.

## What members get

- Invitation-only accounts with unique usernames, passwords and verified email addresses.
- An editable display name, short tasting profile, password and search visibility choice.
- Every active member can host private events or accept invitations to another member’s events. Only that event’s host gets its host controls.
- Hosts select community profiles by username or display name, then members accept their seats from their dashboards. An optional email button notifies the selected member’s saved address.
- Personal history shows a member’s own ballots, their bottle’s result and a link to full revealed standings. History appears after the host reveals the completed event.
- The community owner controls admission. No public registration, public member list or searchable email directory is added.

## Exact production changes

1. Apply `supabase/migrations/20261108201018_community_accounts.sql`. It adds four private tables: profiles, community invitations, member event invitations and request counters. Browser roles have no direct access. It adds service-only functions for membership activation, event-invitation acceptance, rate limits and event saves. **The existing event rows and existing `save_bourbon_event` function are unchanged.**
2. That migration creates active profiles for existing verified event hosts. Existing host `002ee828-fbc2-4df6-ae69-40271a38020d` becomes the community owner; other existing verified hosts, if any, become ordinary members. It does not enroll guest identities or turn members into administrators of others’ events. The original host can choose a preferred username and set a password under My profile.
3. Deploy the updated `bourbon-api` backend. It retains current guest invitation support and creates all new invited identities with service-controlled invitation metadata. It uses the new atomic save function for future updates. Selecting a profile alone does not grant that member a seat; acceptance is required.
4. Apply `supabase/migrations/20261108202247_invite_only_auth.sql`. Its new-user trigger blocks direct, uninvited account creation. Only identities deliberately created by the server after invitation validation pass. Existing accounts, passwords and sessions remain valid. This trigger also means manually adding an account through the generic Supabase user form is not the supported enrollment path.
5. Publish the reviewed source to `jstevnz/blindcap` and deploy the exact commit to Vercel Production, at `https://blindcap.net`. The existing private `RESEND_API_KEY` stays secret; account emails use `invitations@blindcap.net`. No paid plan or new service is requested.

## Preservation and limits

Existing event IDs, participant IDs, bottles, ballots, scores, reveals and guest invitations are retained. New membership records are added; old event data is not rewritten or deleted. A guest opening a community registration invitation while still signed into their guest seat can connect that seat’s existing history after verifying the invitation email. A conflicting second seat in the same event is rejected atomically. For future events, select a member’s profile rather than entering them as a new guest if their results should follow their member account.

Members may host up to 10 new events per day. Community invitation creation is limited to 20 per owner per day; member-event notification requests are limited to 100 per host per day. Registration, login, recovery and invitation lookup have additional per-source, per-account or per-invitation limits. These guardrails reduce accidental overuse; they do not promise unlimited service within free tiers.

The original host remains able to administer existing events. Other members control their own events. Existing email-link sign-in remains available through Resend, and the original host can add a password without creating another account.

## Verification

All 74 automated tests passed, along with the app and backend type checks and optimized Next.js build. The suite covers all tournament sizes 2–16, scoring, runoffs, awards, hidden bottle identities, unique ranks, member-only seat acceptance, private profile fields, email-bound registration, pending membership, recovery email token handling, profile role protection, own-ballot history and parity between website and backend helpers.

The SQL tests execute the real migration files in an isolated local Postgres engine (PGlite). They verify unchanged legacy event data and save function, host enrollment, browser-role restrictions, atomic event saves and invitation creation, repeated acceptance, guest-history transfer, expired/wrong-email activation rejection, conflicting-seat rollback, request caps and rejection of direct or spoofed user creation.

App and backend type checks and the optimized Next.js build must pass before publication. The local in-app browser confirms the new sign-in page renders. Full interactive mobile rehearsal and actual email receipt remain post-deployment checks: the separate automated browser could not launch under this computer’s current permissions. Email tests use a mocked provider and do not send messages to real people.

## Ordered live verification and recovery

Apply the community schema first, deploy the updated backend second, then install the signup guard and deploy the frontend. Verify the original host’s existing event access and profile, direct signup rejection, and existing guest redemption. Have the owner send a real community invitation to a chosen test recipient, verify email, create another host’s rehearsal event and invite the original owner as a participant. Complete and reveal a rehearsal to confirm personal history. Do not modify a real event to simulate ballots.

For a frontend regression, restore the preceding frontend deployment while retaining the additive tables and updated backend. Do not automatically drop tables or delete profiles: these may contain newly joined members and invitations. The old backend creates guest identities differently and must not be restored blindly while the new-user guard is active. Any full backend/schema rollback requires a separate review that preserves member data and invite-only enrollment.
