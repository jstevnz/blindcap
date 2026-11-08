# Running a Blindcap tasting

## Before guests arrive

1. Open the app and sign in with your community username/email and password, or an email sign-in link. Every community member can host an event. The original host can open **My profile & password** to choose a username and set a password without making another account.
2. Name a new event (the name starts blank), choose the number of tasters/bottles (2–16), review the proposed format, and create the event. Open **Host controls**. The selected count is fixed for that event.
3. For each row, search and select an existing community profile, then enter the bourbon they brought. If you are tasting, select your own profile on your row. For an occasional guest without a community account, enter their name and optional email instead. One row means one taster and the bottle they own. Confirm attendance before locking the draw; the roster becomes permanent.
4. Save. Physically wrap each bottle and label it with its row's bottle number (01 through the actual bottle count). Keep identities away from guests.
5. Check participant names and bottle ownership carefully. **Lock setup & draw opening groups** makes them permanent for that event.
6. After the draw, selected members see an event invitation on their dashboard. They sign in and choose **Accept & join** to take their seat. Use **Email event invitation** to notify a selected member at their saved address. For guest rows, create a private invitation link in Host controls. Copy and share each individually. The guest opens it and taps Join the tasting on their phone. Links work once and expire after 72 hours, so issue them close to the event. Do not send one guest another guest’s link. Tasters do not need GitHub, Vercel or email accounts.

## Each flight

- Open the flight from Host controls. Only one flight can be open at once.
- Pour the numbered bottles shown. All registered tasters score every flight.
- Tasters enter four attributes from 1–10 and choose unique preference ranks. Favorite is 1. Submit sends the ballot; selecting scores alone saves only a draft on that device.
- The host sees a progress count and who has submitted. Tasters can revise until the flight closes.
- Wait for every taster’s submission, then close and lock the ballots. Open the next flight.
- After all opening flights, choose **Advance to next stage**. If semifinals are scheduled, repeat after both semifinals. Events with 2–4 tasters start directly with their final; five tasters have one preliminary flight of five, with four qualifying.
- If a blind tie-break appears, open it, collect every taster’s preference rankings and close it. Runoffs do not use attribute ratings. Then retry advancement. A repeated runoff tie requires another runoff.

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

## Emailing private invitations

In Host controls → Private guest invitations, enter an Invitation email and save it. This is a delivery contact only; changing it does not change who owns the taster seat. Create a private link, then use Email invitation beside Copy link. The saved recipient must match the displayed address; save edits before sending.

The app checks that the link belongs to that seat and has not been used, replaced or expired. Email sending uses `invitations@blindcap.net`. “Invitation emailed” means Resend accepted the message; delivery, bounce and spam-folder outcomes are separate. Check Resend’s email logs if needed.

Retries of the same invitation and recipient are protected against duplicate messages for 24 hours. To issue another invitation after a successful send or an expired/used link, create a replacement link and send it. A replacement invalidates the prior unused link.

## Community membership and personal history

New members choose **Sign up** on Home, or open `https://blindcap.net/register`. They enter a full name, display name, username, email and password, plus optional phone, city/state and tasting notes. They verify their email, then remain **pending** until the community owner approves them. Pending applicants can sign in and edit their own profiles, but cannot host events, search members or accept event invitations.

The community owner receives an email at the stored admin address for new signups. Open **Signup reviews** from Home (or the email’s review link) to inspect the profile and email-verification status. **Approve member** is enabled only after verification; approval makes the profile eligible for host searches and event creation. **Delete signup** asks for confirmation and removes only that pending profile and sign-in account. Approved accounts and events cannot be removed through signup review.

Personal signup invitations are still available under **Invite a new member**, but they no longer bypass approval. Hosting does not grant control over anyone else’s events or admission decisions.

**My profile & password** lets each member edit their name, username, tasting bio, search visibility and password. To be found by a host, keep profile search visibility enabled. Searches show names and usernames; email addresses are not a community directory.

**Your tasting history** appears under **Events** after an event is complete and revealed. It includes that member’s own rankings and attribute scores, their bottle’s placement and a link to the full revealed results. A host sees their hosted events, but cannot read other people’s private individual ballots.

If a guest wants to join the community and retain their guest history, have them open their community registration invitation while still signed into that guest seat. Verification connects that seat to the new member profile. For later events, select their existing profile rather than making another guest seat. Existing guest links and submitted ballots remain valid.

## Event history and deletion

Choose **Events** from Home to see current and prior events, filter by completed/in-progress/hosted-by-me, and search by event or host name. Detailed personal tasting history is also on this page, keeping Home compact.

Hosts can delete only events they created. The original community-owner account can see all event summaries and delete any community event. This does not give other hosts access to unrelated events, and the community-wide summary does not expose blind bottle identities or individual ballots.

Choose **Delete event** and check its name, creation time and host in the confirmation prompt. **Keep event** cancels; **Delete permanently** removes that event’s scores, invitations, seat access and tasting history for everyone. Member accounts remain. If the event changes while the prompt is open, deletion stops and you must review the updated list and confirm again.
