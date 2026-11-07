# Blindcap verification

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
