# Standalone events only in series attachment

The Events catalog now includes the series ID of each visible event. The series attachment dropdown excludes all linked events and keeps the existing host/site-owner eligibility check. Empty lists explain that no standalone events are available. The backend explicitly rejects an event already in any series, including the same series, before insertion. The existing unique constraint on bourbon_editions.event_id provides final protection against concurrent links; no migration or existing event changes are needed.

Validation: all 149 tests pass, both TypeScript checks and production build pass. Regression tests cover site-owner and host attempts to attach linked events, successful attachment of a standalone event, subsequent attachment rejection, and database uniqueness across two series. Authorization and visibility remain unchanged. No live event links were modified in verification.
