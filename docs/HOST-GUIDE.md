# Running a Blindcap tasting

## Before guests arrive

1. Open the app on your phone and sign in with your host email.
2. Choose the number of tasters (2–16), review the proposed format, and create an event. Open **Host controls**. The selected count is fixed for that event.
3. Enter the selected number of names and their bourbon names. Emails are optional. If you are tasting, put your signed-in host email on your row. One row means one taster and the bottle they own.
4. Save. Physically wrap each bottle and label it with its row's bottle number (01–12). Keep identities away from guests.
5. Check participant names and bottle ownership carefully. **Lock setup & draw opening groups** makes them permanent for that event.
6. In Host controls, create a private invitation link for each guest. Copy and share each individually. The guest opens it and taps Join the tasting on their phone. Links work once and expire after 72 hours, so issue them close to the event. Do not send one guest another guest’s link. Tasters do not need GitHub, Vercel or email accounts.

## Each flight

- Open the flight from Host controls. Only one flight can be open at once.
- Pour the numbered bottles shown. All registered tasters score every flight.
- Tasters enter four attributes from 1–10 and choose unique preference ranks. Favorite is 1. Submit sends the ballot; selecting scores alone saves only a draft on that device.
- The host sees a progress count and who has submitted. Tasters can revise until the flight closes.
- Wait for every taster’s submission, then close and lock the ballots. Open the next flight.
- After all opening flights, choose **Advance to next stage**. If semifinals are scheduled, repeat after both semifinals. Events with 2–4 tasters start directly with their final; five tasters have one preliminary flight of five, with four qualifying.
- If a blind tie-break appears, open it, collect all 12 preference rankings and close it. Runoffs do not use attribute ratings. Then retry advancement. A repeated runoff tie requires another runoff.

## Final and reveal

1. Close the final after every taster has submitted.
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
- Allow time between stages to check submissions and prepare pours. Larger events can involve seven flights plus runoffs; plan small pours, food, water and safe transportation.
