# Blindcap

Blindcap is a mobile-first blind bourbon tournament for 12 tasters and 12 bottles. Next.js 16 + React 19 on Vercel, with Supabase Auth, Postgres and a Supabase Edge Function.

## Agreed scoring

- Four opening groups of three; two advance per group.
- Two semifinals of four; two advance per group.
- One final of four. All 12 tasters judge every flight, including their own anonymous bottle.
- Each ballot: 80% forced preference ranking; 5% each aroma, flavor, smoothness and overall enjoyment.
- Preference is linearly normalized from 100 for first to 0 for last. Integer attributes 1–10 map to 0–100. Twelve equally weighted ballots determine each round score.
- Advancement uses current-round score. Ties break on preference, then enjoyment; a remaining cutoff tie requires a blind preference-only runoff. Repeat tied runoffs.
- Finalists occupy places 1–4, weighted 20/30/50 across stages. Semifinal eliminations occupy 5–8, weighted 40/60. Opening eliminations occupy 9–12, opening score only.
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
