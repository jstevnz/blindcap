# Blindcap

Blindcap is a mobile-first blind bourbon tournament for 2–16 tasters, each bringing one bottle. Next.js 16 + React 19 on Vercel, with Supabase Auth, Postgres and a Supabase Edge Function.

## Agreed scoring

- Choose the event’s taster count (2–16) up front; one bottle per taster. The preview shows the tournament before creation and before the draw.
- 2–4: final only (including a two-bottle head-to-head).
- 5: one opening group of five, top four to the final.
- 6–8: two balanced opening groups, top two each to the final.
- 9–11: three balanced opening groups, top two each; two semifinals of three, top two each to the final.
- 12–16: four balanced opening groups, top two each; two semifinals of four, top two each to the final.
- Every registered taster judges every flight, including their own anonymous bottle. Every ballot is required to close a flight.
- Each ballot: 80% forced preference ranking; 5% each aroma, flavor, smoothness and overall enjoyment.
- Preference is linearly normalized from 100 for first to 0 for last. Integer attributes 1–10 map to 0–100. Twelve equally weighted ballots determine each round score.
- Advancement uses current-round score. Ties break on preference, then enjoyment; a remaining cutoff tie requires a blind preference-only runoff. Repeat tied runoffs.
- Finalists rank ahead of semifinal eliminations, then opening eliminations. Weight each bottle’s completed stages proportionally: opening/semifinal/final 20/30/50 when all apply, opening/final 2/7 and 5/7 when semifinals are skipped, and 100% final for final-only events. Semifinal eliminations use 40/60; opening eliminations use opening scores only. Places run 1 through the actual bottle count.
- Weighted preference, then weighted enjoyment break placement ties. Remaining ties share competition places except first and last, which use blind runoffs.
- First earns the Yorktown Tumbler; last earns the Swill Award.
- Scores retain full precision for decisions; display rounds to two decimals. Scores compare only within the same placement tier. Different group opponents remain a tournament limitation.

## Development

Node 24 recommended. Install pnpm 10.34.0, then:

```sh
pnpm install --frozen-lockfile
cp .env.example .env.local
# Fill in the Supabase project URL and publishable key, which are public client configuration.
pnpm test
pnpm typecheck
pnpm build
pnpm dev
```

No privileged database key belongs in Next.js, a browser, a repository or Vercel configuration. Supabase supplies its service key only inside its Edge Function runtime.

## Backend and deployment

1. Apply the SQL migrations to the intended Supabase project.
2. Deploy `supabase/functions/bourbon-api` through Supabase. `lib/engine.ts` is the canonical scoring engine; copy it to the function's `engine.ts` before deployment. The test suite verifies parity.
3. The function does its own authentication using `auth.getUser(accessToken)` on every request. Gateway legacy JWT checking is disabled to support modern Supabase tokens; unauthenticated requests still return 401.
4. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in Vercel.
5. Set Supabase Auth Site URL to the production website origin and allow its `/auth/callback` URL. Also allow `http://127.0.0.1:3000/auth/callback` for local development. Keep email confirmation enabled.
6. Hosts use their Supabase organization email to sign in. Guests use private single-use invitation links; they do not need email delivery. Links expire after 72 hours, are stored only as SHA-256 digests, and are sent manually by the host. Redemption creates an isolated synthetic Supabase identity and binds it only to the assigned event seat. Guest identities cannot create events. A replacement invalidates an unused link and replaces prior guest access when redeemed.
7. Vercel production access must permit guests to reach the app without Vercel accounts. This is separate from the application’s own sign-in and invitation checks. The initial deployment preserves the platform gate until the owner approves removal.
8. Run all checks before a production deployment, then rehearse sign-in, setup, all stages and reveal with actual devices.

## Security boundaries

Raw event state is server-only: RLS is enabled and browser roles have no table or mutation-function privileges. All backend reads verify event ownership or invitation membership or an authenticated guest-seat binding. Tasters receive only bottle numbers, progress, their own ballots and (after reveal) bottle identities, ownership and results. Admins receive setup identities, submission progress and aggregate round results, but not other tasters' individual ballots.

Every mutation compares the expected revision. The SQL compare-and-swap updates state and membership in one transaction, preventing lost ballots and close/submit races. Conflicts preserve local draft entries and request resubmission. Closed groups are immutable. Setup locks after the draw. Reveal is permanent.

The host controls the ceremony; the software cannot keep the host blind because they enter bottle identities. Physically wrap and label bottles. Invitations and sign-in accounts identify tasters but cannot prove who physically holds a phone.

## Operating guide

See [Host guide](docs/HOST-GUIDE.md). No actual participant names, bottle identities or votes are included in this repository.

## Invitation email delivery

Save `RESEND_API_KEY` directly in Vercel as a Production Secret, scoped to sending from the verified `blindcap.net` domain. Never expose it under a public variable or copy it into source. The browser submits only the seat and existing token; the backend checks host ownership, the current invitation digest, expiration and redemption status, then returns the saved delivery address to the server. User-supplied recipient overrides and arbitrary links are not accepted.

Resend requests use deterministic idempotency keys to protect retries for 24 hours. Transport failures preserve the existing invitation so the same request can be retried. Tests mock the provider and do not email real guests. Verify inbox delivery with a host-controlled test seat before sending event invitations.
