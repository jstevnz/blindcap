# Invite-first event enrollment

New events and new annual editions use the participant enrollment workflow. Existing events retain their original setup and stored ballots.

Hosts search approved discoverable profiles and select a person before their email appears. Each participant is saved separately. Manual seats require first name, last name and email. Saving does not send email. The host publishes the saved roster and explicitly sends the group invitations; unsuccessful deliveries can be retried without resending already recorded deliveries.

Manual invitees receive signup instructions. After verified signup and owner approval, a matching email connects their approved profile to the reserved seat and queues the event invitation. Acceptance remains a separate participant action. Approval, seat linking and invitation acceptance are not bypassed.

The welcome page displays event branding and Bourbon Tasting rules. Accepted participants enter their own bottle name, distillery and proof. Hosts can enter missing details and correct bottles until tasting starts. The draw requires every selected participant to have an active approved profile, accept the invitation and complete their bottle details. Preparing the draw does not open a flight; the host begins each flight.

Each flight has a freshly randomized cup mapping and a host-only pour sheet identifying covered bottles, owners and cup numbers. All tasters receive the same mapping in that flight. Participants receive temporary group-specific identifiers, preventing stable bottle identifiers from connecting rounds. Existing advancement and scoring calculations remain unchanged.

## Database and backend

Migration `20261110045257_participant_enrollment.sql` adds private reserved seats, delivery timestamps and service-only save/link functions. It does not modify existing event states or ballots. The linking function serializes changes through the event row and preserves seat and bottle IDs. Replacing a seat removes stale invitation/access records atomically. Anonymous and signed-in browser roles have no access to the reservation table or functions.

The replacement `bourbon-api` bundle includes `enrollment.ts`. It preserves manual authentication and blind-host locks. Selected contact information and pour guides require event-admin authorization. Participant bottle edits require accepted access to their own seat. Production email credentials remain server-side; no keys are included in source.

## Verification

- All 143 tests pass, including real PostgreSQL-compatible migration rehearsal, approval/email matching, invitation delivery retries, authorization, bottle edits, alias forgery rejection and all tournament stages.
- Frontend and Edge TypeScript checks pass; production build passes.
- Browser checks with synthetic local data verified search-first selection, manual seats, save-before-send, invitation acceptance, participant bottle submission and host correction.
- At 375px, participant entry has no horizontal overflow; inputs use 16px text and controls exceed 44px height.
- No real invitations were sent and no production accounts/events were created for verification.

## Rollout

Apply the additive migration, replace the reviewed backend bundle, publish the matching GitHub commit and deploy that exact commit to Vercel. Verify deployment readiness and public/authenticated route gates. Existing events continue their original workflow; create a new event or edition to use enrollment.
