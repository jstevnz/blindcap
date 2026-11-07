import { randomBytes, createHash, randomUUID } from "node:crypto";
import { createClient } from "npm:@supabase/supabase-js@2.119.0";
import {
  applyCommand,
  createEvent,
  snapshot,
  authorized,
  type Event,
  type Actor,
} from "./engine.ts";
// The privileged key stays inside Supabase's function environment, never in Next.js or the browser.
Deno.serve(async (req: Request) => {
  const json = (data: unknown, status = 200) =>
    Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
  try {
    if (req.method !== "POST")
      return json({ error: "Method not allowed." }, 405);

    const text = await req.text();
    if (text.length > 64000)
      return json({ error: "Request is too large." }, 413);
    const input = JSON.parse(text);
    const authorization = req.headers.get("authorization");
    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    if (input.action === "redeem") {
      if (
        typeof input.token !== "string" ||
        !/^[a-f0-9]{64}$/.test(input.token)
      )
        return json(
          {
            error: "This invitation is invalid. Ask your host for a new link.",
          },
          400,
        );
      const digest = createHash("sha256").update(input.token).digest("hex");
      const { data: consumed, error: consumeError } = await db.rpc(
        "consume_bourbon_invite",
        { p_hash: digest },
      );
      if (consumeError)
        throw new Error("Unable to check your invitation. Please try again.");
      const invite = consumed?.[0];
      if (!invite)
        return json(
          {
            error:
              "This invitation was used or expired. Ask your host for a new link.",
          },
          410,
        );
      // A fresh synthetic identity cannot impersonate an existing email account or another event's guest.
      const guestEmail = `guest-${randomUUID()}@guests.blindcap.invalid`;
      const { data: link, error: linkError } = await db.auth.admin.generateLink(
        { type: "magiclink", email: guestEmail },
      );
      if (linkError || !link?.properties?.hashed_token || !link.user)
        throw new Error(
          "Unable to start your session. Ask your host for a replacement link.",
        );
      const { error: grantError } = await db
        .from("bourbon_guest_access")
        .upsert(
          {
            event_id: invite.event_id,
            participant_id: invite.participant_id,
            auth_user_id: link.user.id,
          },
          { onConflict: "event_id,participant_id" },
        );
      if (grantError)
        throw new Error(
          "Unable to assign your seat. Ask your host for a replacement link.",
        );
      return json({
        tokenHash: link.properties.hashed_token,
        eventId: invite.event_id,
      });
    }
    if (!authorization?.startsWith("Bearer "))
      return json({ error: "Please sign in." }, 401);
    const { data: auth, error: authError } = await db.auth.getUser(
      authorization.slice(7),
    );
    if (authError || !auth.user?.email || !auth.user.email_confirmed_at)
      return json({ error: "Please sign in with your verified email." }, 401);
    const a: Actor = { id: auth.user.id, email: auth.user.email.toLowerCase() };

    if (input.action === "list") {
      const [owned, invited, guest] = await Promise.all([
        db.from("bourbon_events").select("id,state").eq("owner_id", a.id),
        db
          .from("bourbon_events")
          .select("id,state")
          .contains("member_emails", [a.email]),
        db
          .from("bourbon_guest_access")
          .select("event_id")
          .eq("auth_user_id", a.id),
      ]);
      if (owned.error || invited.error || guest.error)
        throw new Error("The database could not be reached.");
      const guestEvents = guest.data?.length
        ? await db
            .from("bourbon_events")
            .select("id,state")
            .in(
              "id",
              guest.data.map((g) => g.event_id),
            )
        : { data: [], error: null };
      if (guestEvents.error)
        throw new Error("Unable to load your invitations.");
      const rows = [
        ...new Map(
          [
            ...(owned.data ?? []),
            ...(invited.data ?? []),
            ...(guestEvents.data ?? []),
          ].map((x) => [x.id, x]),
        ).values(),
      ];
      return json(
        rows.map((x) => ({
          id: x.id,
          title: x.state.title,
          phase: x.state.phase,
          admin: x.state.ownerId === a.id,
        })),
      );
    }
    if (input.action === "create") {
      if (a.email.endsWith("@guests.blindcap.invalid"))
        return json(
          {
            error:
              "Guest seats cannot create events. Sign in with your host email.",
          },
          403,
        );
      if (typeof input.title !== "string")
        throw new Error("Enter an event name.");
      const event = createEvent(a.id, input.title);
      const { error } = await db.from("bourbon_events").insert({
        id: event.id,
        owner_id: a.id,
        revision: 0,
        state: event,
        member_emails: [],
      });
      if (error) throw new Error("Unable to create the event.");
      return json({ id: event.id });
    }
    if (typeof input.id !== "string" || !/^[0-9a-f-]{36}$/i.test(input.id))
      return json({ error: "Event not found." }, 404);
    const { data, error } = await db
      .from("bourbon_events")
      .select("state")
      .eq("id", input.id)
      .maybeSingle();
    if (error) throw new Error("The database could not be reached.");
    if (!data) return json({ error: "Event not found." }, 404);
    const event = data.state as Event;
    const { data: guestAccess, error: guestError } = await db
      .from("bourbon_guest_access")
      .select("participant_id")
      .eq("event_id", event.id)
      .eq("auth_user_id", a.id)
      .maybeSingle();
    if (guestError) throw new Error("Unable to verify your seat.");
    if (guestAccess) a.guestParticipantId = guestAccess.participant_id;
    if (!authorized(event, a))
      return json({ error: "You are not invited to this event." }, 403);
    if (input.action === "get") return json(snapshot(event, a));
    if (input.action === "invite") {
      if (event.ownerId !== a.id)
        return json(
          { error: "Only the event admin can issue invitations." },
          403,
        );
      if (event.phase === "setup")
        throw new Error(
          "Lock setup and draw opening groups before issuing invitations.",
        );
      if (!event.participants.some((p) => p.id === input.participantId))
        throw new Error("Select a registered taster.");
      const token = randomBytes(32).toString("hex");
      const digest = createHash("sha256").update(token).digest("hex");
      const { error: inviteError } = await db.from("bourbon_invites").upsert(
        {
          event_id: event.id,
          participant_id: input.participantId,
          token_hash: digest,
          expires_at: new Date(Date.now() + 72 * 3600000).toISOString(),
          redeemed_at: null,
        },
        { onConflict: "event_id,participant_id" },
      );
      if (inviteError) throw new Error("Unable to issue this invitation.");
      return json({ token });
    }
    if (input.action !== "command") throw new Error("Unknown action.");
    const c = input.command;
    if (c?.revision !== event.revision)
      return json(
        {
          error:
            "The event changed. Your entries are preserved; review the latest state and submit again.",
        },
        409,
      );
    const next = applyCommand(event, a, c);
    const { data: saved, error: saveError } = await db.rpc(
      "save_bourbon_event",
      {
        p_id: event.id,
        p_revision: event.revision,
        p_state: next,
        p_member_emails: next.participants.map((p) => p.email).filter(Boolean),
      },
    );
    if (saveError)
      throw new Error("Your changes could not be saved. Please try again.");
    if (!saved)
      return json(
        {
          error:
            "Another update arrived first. Your entries are preserved; please submit again.",
        },
        409,
      );
    return json(snapshot(next, a));
  } catch (error) {
    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to complete this request.",
      },
      400,
    );
  }
});
