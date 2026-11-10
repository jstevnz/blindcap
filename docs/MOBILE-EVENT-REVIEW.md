# Mobile participant interface review

Event-only CSS refinements reduce the phone masthead, place the series logo beside the event title, tighten spacing before the active flight, and preserve larger desktop branding. The form keeps two score columns on phones, uses 16px input text, 48px-or-larger controls, a full-width 52px submit button, safe-area bottom spacing, flexible tabs/rows and contained results-table scrolling. Fieldsets and grid columns can shrink without forcing horizontal page scrolling. Scoring and authentication code are unchanged.

Verified with a local interactive fixture using the actual Ballot component source and production stylesheet, synthetic participants and three bottles. No production events, ballots or logos were changed for testing. Local fixture files remain under work/ and are not shipped.

- Phone widths: 320, 375, 390 and 430 CSS pixels; no horizontal page overflow.
- Tablet and desktop checks: 768 and 1280px; no horizontal page overflow.
- Minimum tested control height: 48px.
- At 375px, masthead height drops from approximately 155px to 91px, and the first scoring control moves from approximately 1350px to 896px from the document top.
- Score inputs, unique-rank validation, disabled submission for duplicate ranks, successful local submission and draft persistence after reload verified through the UI.
- Visual inspection confirms both logos fit, text stays readable, and all three bottles remain ordered smallest number first.

These are browser viewport checks, not tests on physical phones. Existing server scoring tests and production build remain the release checks. This release changes only presentation CSS and this review document; no backend, database, membership or privacy changes.
