# Running a Blindcap tasting

## Before guests arrive

1. Open the app on your phone and sign in with your host email.
2. Create an event. Open **Host controls**.
3. Enter 12 names and their bourbon names. Emails are optional. If you are tasting, put your signed-in host email on your row. One row means one taster and the bottle they own.
4. Save. Physically wrap each bottle and label it with its row's bottle number (01–12). Keep identities away from guests.
5. Check participant names and bottle ownership carefully. **Lock setup & draw opening groups** makes them permanent for that event.
6. In Host controls, create a private invitation link for each guest. Copy and share each individually. The guest opens it and taps Join the tasting on their phone. Links work once and expire after 72 hours, so issue them close to the event. Do not send one guest another guest’s link. Tasters do not need GitHub, Vercel or email accounts.

## Each flight

- Open the flight from Host controls. Only one flight can be open at once.
- Pour the numbered bottles shown. All 12 tasters score every flight.
- Tasters enter four attributes from 1–10 and choose unique preference ranks. Favorite is 1. Submit sends the ballot; selecting scores alone saves only a draft on that device.
- The host sees a progress count and who has submitted. Tasters can revise until the flight closes.
- Wait for 12/12, then close and lock the ballots. Open the next flight.
- After all four opening flights, choose **Advance to next stage**. Repeat after both semifinals.
- If a blind tie-break appears, open it, collect all 12 preference rankings and close it. Runoffs do not use attribute ratings. Then retry advancement. A repeated runoff tie requires another runoff.

## Final and reveal

1. Close the final after 12 ballots.
2. Select **Finalize results & check award ties**.
3. Complete any blind award runoffs and finalize again.
4. Preview standings as host. Select **Reveal bottles & awards** when ready for the ceremony. Confirming makes the reveal permanent.
5. Everyone can now see the full field, bottle owners, weighted breakdown, Yorktown Tumbler, Swill Award, their own bottle results and their private tasting journal.

## Recovery and rehearsal

- A network failure or conflicting update does not discard the current ballot draft. Refresh progress and submit again.
- Drafts are local to the device and browser. A submitted ballot is stored in Supabase. Use the same phone throughout a flight.
- If a guest loses their device or session, issue a replacement invitation for their seat. Once it is redeemed, their earlier guest identity no longer has access. Submitted ballots stay with the seat. The app intentionally has no fabricated ballot or forced-close bypass.
- Run a rehearsal event well before the tasting. Use private guest links on actual devices; never use the actual night to discover access problems.
- Keep the Supabase project active before the event; a free project may pause after inactivity. Verify it is running before guests arrive.
- Allow time between stages to check submissions and prepare pours. Seven flights mean a substantial number of samples; plan small pours, food, water and safe transportation.
