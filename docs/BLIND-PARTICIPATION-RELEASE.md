# Blind participation with an emergency recovery path

## User flow

Use the existing approved profile. Before any bottles are entered, open Home → Events (Event management), choose Participate blind on the event, choose another approved coordinator, acknowledge delegation and confirm. The coordinator adds the same profile as a taster; no second email or account is needed. For an annual edition already owned by the coordinator, the site owner can select that coordinator and lock their own account the same way.

Inside the event, a locked user has normal taster access only: no host controls, bottle names/owners before reveal, unpublished results, invitation tools, host-team access, mailing addresses, delegation or event deletion. A valid taster seat is still required to enter or vote. The selected coordinator retains normal host controls. The primary host is labeled as participating blind in the coordinator’s team view when appropriate.

Emergency host unlock is offered only on the Events management screen, never inside the event. It requires a named-event confirmation, current revision and explicit acknowledgement that host access ends blind status. It restores event host access and permits replacing admins/finishing the event. It records actor, action and server timestamp; ballots, scores and ownership are unchanged. The account cannot mark itself blind again for that event. Voting is not automatically disqualified or reweighted.

## Enforcement

Blind state and audit records are stored in the existing event JSON with the existing atomic revision save. No database migration or public permission changes are needed. Only the active primary host or site owner may change their own blind status. Lock requires setup with no bottle entries and another approved non-blind coordinator. Backend admin authorization checks blind lock first, overriding ownership/co-admin status. Team management and deletion are also explicitly blocked. Co-admin assignment cannot appoint a locked participant. Emergency rights cannot be obtained through the ordinary team API.

## Validation

135 tests passed, plus production build and backend typecheck. Tests cover direct API reads/commands, team delegation, mailing/invitation/deletion denial, hidden identities, normal ballot submission while locked, revision checks, coordinator independence, ordinary-user denial, explicit emergency recovery, audit records, preserved ballots, and irreversible loss of blind designation. The confirmation UI was tested locally with synthetic event data: unlock disabled until acknowledged; no real event changed.

## Release and recovery

Deploy the reviewed authenticated backend first, then the matching GitHub/Vercel frontend. No existing event is automatically locked or unlocked. After users enable locks, do not roll the backend back to a version that ignores blind state; use a forward fix or a rollback that preserves these authorization guards. The UI can be rolled back while the backend guards remain in place.
