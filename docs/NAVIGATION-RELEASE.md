# Organized member navigation

The signed-in home has three primary destinations for the community owner: Events (View and Manage), Signup Reviews (Approve Pending Profiles), and My Profile and Password. Approved members receive Events and Profile; owner-only review permissions remain enforced by the backend. Event creation and series browsing no longer compete as separate home destinations. Owner signup-invitation tools move to Signup Reviews, and event invitations move to Events.

Events defaults to All Community Events for the site owner and My Events for other members. Hosting is a separate view and includes co-admin responsibilities. Existing event search, status filters, deletion confirmation and blind participation/emergency unlock controls are preserved. Series are opened inside Events, displaying their years, historical results and leaderboard. Existing /series links redirect to the matching Events destination.

Create an Event offers one-time events, a new recurring series with its first year, or a new year in an existing managed series. Naming starts blank; Bourbon Tasting remains the only event type and 2–16 participants remain supported. Optional series logo and awards can be entered during creation. Existing series management tools remain available inside series detail.

Profile contains personal details, password, participated events, submitted bottles, private scoring selections and awards. The same participated history is available from My Events. Historical years appear when their participant record is linked to the signed-in profile. Revealed event history includes participant names and full bottle outcomes, while other members’ ballots and private contacts are excluded. Upcoming history exposes only the accepted participant’s own bottle. Merely hosting or having owner privileges does not count as participation.

## Validation

- 146 tests pass, including owner-versus-member event categorization, linked historical participation, unrevealed bottle privacy and existing invitation, blind-access and deletion checks.
- Frontend and Edge TypeScript checks pass; production build passes.
- Actual components were checked in a local browser with synthetic owner/member data: home categories, community/personal views, series years, creation options and profile history.
- Phone checks at 375px found no horizontal overflow. Profile/Events fields use 16px text on phones.
- No production events, profiles or emails were changed for these checks.

## Publication

No schema changes. Publish matching GitHub source, replace bourbon-api with the reviewed bundle and deploy the exact commit to the existing Blindcap production project. Preserve existing authentication, role checks and data. Verify deployment readiness, matching commit, public routes and private API gates afterward. Authenticated production behavior is covered by local browser fixtures and automated backend tests; no real account credentials are used in the checks.
