import {enrollmentAction,profileNames} from "./enrollment.ts";
import {isBlindLocked,blindAccessChange} from "./blind-access.ts";
import {canManageTeam,setCoAdmins,eventTeam,mailingList} from "./event-team.ts";
import {seriesLogoUrl} from "./series-logos.ts";
import { seriesAction } from "./series.ts";
import { photoAction } from "./photos.ts";
import { canDeleteEvent, eventSummary } from "./event-management.ts";
import { communityAction, getProfile, rate, send } from "./community.ts";
import { historyFor } from "./community-shared.ts";
import { randomBytes, createHash, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import {
  applyCommand,
  createEvent,
  snapshot,
  authorized,
  isEventAdmin,
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
    if (
      input.action === "community" &&
      [
        "invitation",
        "register",
        "apply",
        "login",
        "recover",
        "email-login",
      ].includes(input.operation)
    )
      return json(await communityAction(input, db, null, req));
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
      const { data: guest, error: guestCreateError } =
        await db.auth.admin.createUser({
          email: guestEmail,
          email_confirm: true,
          app_metadata: { blindcap_managed: true },
        });
      if (guestCreateError || !guest.user)
        throw new Error(
          "Unable to create your guest seat. Ask your host for a replacement link.",
        );
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
      const { data: edition } = await db.from("bourbon_editions").select("series_id").eq("event_id", invite.event_id).maybeSingle();
      if (edition) {
        const { error } = await db.from("bourbon_series_members").upsert({series_id:edition.series_id,user_id:link.user.id});
        if(error) throw new Error("Unable to assign series history access.");
      }
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

    if (input.action === "community" && String(input.operation).startsWith("photo-"))
      return json(await photoAction(input, db, a));
    if (input.action === "series") return json(await seriesAction(input, db, a));
    if (input.action === "community")
      return json(await communityAction(input, db, a, req));
    const communityProfile = await getProfile(db, a.id);
    if (
      !communityProfile &&
      auth.user.app_metadata?.blindcap_managed &&
      !a.email.endsWith("@guests.blindcap.invalid")
    )
      return json(
        {
          error:
            "Your membership profile is unavailable or awaiting account cleanup.",
        },
        403,
      );
    if (communityProfile?.status === "suspended")
      return json({ error: "Your community membership is suspended." }, 403);
    if (communityProfile?.status === "pending")
      return json(
        { error: "Your profile is pending administrator approval." },
        403,
      );
    if (["list", "history", "catalog"].includes(input.action)) {
      const [owned, invited, guest] = await Promise.all([
        input.action === "catalog" &&
        communityProfile?.status === "active" &&
        communityProfile.role === "owner"
          ? db
              .from("bourbon_events")
              .select("id,state,created_at")
              .order("created_at", { ascending: false })
          : db
              .from("bourbon_events")
              .select("id,state,created_at")
              .or(`owner_id.eq.${a.id},admin_ids.cs.{${a.id}}`),
        db
          .from("bourbon_events")
          .select("id,state,created_at")
          .contains("member_emails", [a.email]),
        db
          .from("bourbon_guest_access")
          .select("event_id,participant_id")
          .eq("auth_user_id", a.id),
      ]);
      if (owned.error || invited.error || guest.error)
        throw new Error("The database could not be reached.");
      const guestEvents = guest.data?.length
        ? await db
            .from("bourbon_events")
            .select("id,state,created_at")
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
      if (input.action === "catalog") {
        const global =
          communityProfile?.status === "active" &&
          communityProfile.role === "owner";
        const ownerIds = [...new Set(rows.map((row) => row.state.ownerId))];
        const hosts = ownerIds.length
          ? await db
              .from("bourbon_profiles")
              .select("id,display_name")
              .in("id", ownerIds)
          : { data: [], error: null };
        if (hosts.error) throw new Error("Unable to load event hosts.");
        const events = rows
          .map((row) =>
            eventSummary(
              row.state as Event,
              row.created_at,
              hosts.data?.find((h) => h.id === row.state.ownerId)
                ?.display_name ?? "Event host",
              {
                ...a,
                guestParticipantId: guest.data?.find(
                  (g) => g.event_id === row.id,
                )?.participant_id,
              },
              communityProfile,
            ),
          )
          .filter((row) => global || row.canOpen || row.hostedByMe)
          .sort(
            (x, y) =>
              y.createdAt.localeCompare(x.createdAt) ||
              x.id.localeCompare(y.id),
          );
        return json({
          events,
          communityOwner: global,
          member: communityProfile?.status === "active",
        });
      }
      if (input.action === "history") {
        if (communityProfile?.status !== "active")
          return json(
            {
              error: "Community membership is required for permanent history.",
            },
            403,
          );
        const histories = [];
        for (const row of rows) {
          const seat = guest.data?.find(
            (g) => g.event_id === row.id,
          )?.participant_id;
          const actor = { ...a, guestParticipantId: seat };
          if (!authorized(row.state as Event, actor)) continue;
          const result = historyFor(row.state as Event, actor);
          if (result) histories.push(result);
        }
        return json({ events: histories });
      }
      return json(
        rows
          .filter(
            (x) =>
              isEventAdmin(x.state as Event,a) ||
              guest.data?.some((g) => g.event_id === x.id) ||
              authorized(x.state as Event, a),
          )
          .map((x) => ({
            id: x.id,
            title: x.state.title,
            phase: x.state.phase,
            admin: isEventAdmin(x.state as Event,a),
          })),
      );
    }
    if (input.action === "create") {
      if (communityProfile?.status !== "active")
        return json(
          {
            error: "Join the private community before creating events.",
          },
          403,
        );
      if (typeof input.title !== "string")
        throw new Error("Enter an event name.");
      await rate(db, "event-create:" + a.id, 10, 86400);
      const event = createEvent(a.id, input.title, input.tasterCount ?? 12,input.eventType);
      event.workflowVersion=2;
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
    if(input.action === "enrollment") {
      const result=await enrollmentAction(input,db,event,a,(to,subject,text,key)=>send(db,req,to,subject,text,key));
      if(input.operation==="welcome"){
        const {data:edition}=await db.from("bourbon_editions").select("series_id").eq("event_id",event.id).maybeSingle();
        const {data:series}=edition?await db.from("bourbon_series").select("logo_path,winner_award,swill_award").eq("id",edition.series_id).maybeSingle():{data:null};
        return json({...result,logoUrl:await seriesLogoUrl(db,series?.logo_path),winnerAward:series?.winner_award??"Yorktown Tumbler",swillAward:series?.swill_award??"Swill Award"});
      }
      return json(result);
    }
    if(input.action === "blind-access") {
      const next=blindAccessChange(event,a,communityProfile,{operation:input.operation,revision:input.revision,title:input.title,confirmed:input.confirmed,coordinatorId:input.coordinatorId},new Date().toISOString());
      if(input.operation==="lock") {
        const coordinator=await getProfile(db,String(input.coordinatorId));
        if(coordinator?.status!=="active")throw new Error("Select another approved coordinator.");
      }
      const {data:saved,error}=await db.rpc("save_bourbon_community_event",{p_id:event.id,p_revision:event.revision,p_state:next,p_member_emails:next.participants.map(p=>p.email).filter(Boolean)});
      if(error||!saved)throw new Error("The event changed. Refresh Event management and confirm again.");
      return json({saved:true,blindParticipation:input.operation==="lock"?"blind":"unlocked"});
    }
    if(input.action === "team") return json(await eventTeam(db,event,a,communityProfile));
    if(input.action === "team-set") {
      const next=setCoAdmins(event,a,communityProfile,input.adminIds,input.revision);
      if(next.adminIds?.length) {
        const {data:profiles,error}=await db.from("bourbon_profiles").select("id").in("id",next.adminIds).eq("status","active");
        if(error||profiles?.length!==next.adminIds.length) throw new Error("Select approved community members as co-admins.");
      }
      const {data:saved,error}=await db.rpc("save_bourbon_community_event",{p_id:event.id,p_revision:event.revision,p_state:next,p_member_emails:next.participants.map(p=>p.email).filter(Boolean)});
      if(error||!saved) throw new Error("The event changed or could not be saved. Refresh and try again.");
      return json({saved:true});
    }
    if(input.action === "mailing-list") return json(await mailingList(db,event,a));
    if (input.action === "delete") {
      if(isBlindLocked(event,a.id))return json({error:"End blind participation from Event management before making admin changes."},403);
      if (!canDeleteEvent(event.ownerId, a.id, communityProfile))
        return json(
          {
            error:
              "Only this event’s host or the community owner can delete it.",
          },
          403,
        );
      if (
        input.confirmed !== true ||
        input.title !== event.title ||
        !Number.isInteger(input.revision)
      )
        return json(
          { error: "Confirm the named event before deleting it." },
          400,
        );
      if (input.revision !== event.revision)
        return json(
          {
            error:
              "This event changed. Review the updated event and confirm deletion again.",
          },
          409,
        );
      const { data: removed, error: deleteError } = await db.rpc(
        "delete_bourbon_event",
        {
          p_id: event.id,
          p_actor: a.id,
          p_revision: input.revision,
          p_title: input.title,
        },
      );
      if (deleteError)
        throw new Error("The event could not be deleted. Please try again.");
      if (!removed)
        return json(
          {
            error:
              "The event or your permissions changed. Refresh Events and confirm again.",
          },
          409,
        );
      return json({ deleted: true, id: event.id });
    }
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
    if (input.action === "get") {
      const { data: memberInvites } = await db
        .from("bourbon_member_invites")
        .select("participant_id,status")
        .eq("event_id", event.id);
      const {data:edition} = await db.from("bourbon_editions").select("series_id,year").eq("event_id",event.id).maybeSingle();
      const series = edition ? (await db.from("bourbon_series").select("id,title,winner_award,swill_award,logo_path").eq("id",edition.series_id).single()).data : null;
      return json({
        ...snapshot(event, a),
        enrollmentProgress:event.workflowVersion===2?{confirmed:(memberInvites??[]).filter(i=>i.status==="accepted").length,complete:event.bottles.filter(b=>b.name&&b.distillery&&b.proof).length}:null,
        series:series ? {id:series.id,title:series.title,year:edition!.year,logoUrl:await seriesLogoUrl(db,series.logo_path),winnerAward:series.winner_award,swillAward:series.swill_award} : null,
        memberInvitations:
          isEventAdmin(event,a)
            ? (memberInvites ?? []).map((i) => ({
                participantId: i.participant_id,
                status: i.status,
              }))
            : [],
      });
    }
    if (input.action === "invite") {
      if (!isEventAdmin(event,a))
        return json(
          { error: "Only the event admin can issue invitations." },
          403,
        );
      if (event.phase === "setup")
        throw new Error(
          "Lock setup and draw opening groups before issuing invitations.",
        );
      if (
        event.participants.find((p) => p.id === input.participantId)?.accountId
      )
        throw new Error(
          "This seat belongs to a community member. Use their member invitation.",
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
    if (input.action === "invite-details") {
      if (!isEventAdmin(event,a))
        return json(
          { error: "Only the event admin can email invitations." },
          403,
        );
      const participant = event.participants.find(
        (p) => p.id === input.participantId,
      );
      if (!participant) throw new Error("Select a registered taster.");
      if (
        typeof input.token !== "string" ||
        !/^[a-f0-9]{64}$/.test(input.token)
      )
        throw new Error("Create a valid private invitation first.");
      const digest = createHash("sha256").update(input.token).digest("hex");
      const { data: invite, error: inviteError } = await db
        .from("bourbon_invites")
        .select("expires_at")
        .eq("event_id", event.id)
        .eq("participant_id", participant.id)
        .eq("token_hash", digest)
        .is("redeemed_at", null)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      if (inviteError)
        throw new Error("Unable to check this invitation. Please try again.");
      if (!invite)
        throw new Error(
          "This link was used, replaced or expired. Create a new invitation before emailing it.",
        );
      const email = participant.invitationEmail ?? participant.email;
      if (!email)
        throw new Error("Save an email address for this taster first.");
      return json({
        eventId: event.id,
        participantId: participant.id,
        eventTitle: event.title,
        name: participant.name,
        email,
        expiresAt: invite.expires_at,
      });
    }
    if (input.action === "member-email-details") {
      if (!isEventAdmin(event,a))
        return json(
          { error: "Only the event host can email member invitations." },
          403,
        );
      const participant = event.participants.find(
        (p) => p.id === input.participantId,
      );
      if (!participant?.accountId || event.phase === "setup")
        throw new Error(
          "Lock the draw with this member selected before sending an invitation.",
        );
      const target = await getProfile(db, participant.accountId);
      if (target?.status !== "active")
        throw new Error("This community member is not available.");
      const { data: memberInvite } = await db
        .from("bourbon_member_invites")
        .select("status")
        .eq("event_id", event.id)
        .eq("participant_id", participant.id)
        .maybeSingle();
      if (memberInvite?.status !== "pending")
        throw new Error("This member invitation is no longer pending.");
      await rate(db, "member-email:" + a.id, 100, 86400);
      return json({
        eventId: event.id,
        participantId: participant.id,
        eventTitle: event.title,
        name: target.display_name,
        email: target.email,
      });
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
    if(c.type==="start"&&event.workflowVersion===2){
      const {data:invitations,error}=await db.from("bourbon_member_invites").select("participant_id,invitee_id,status").eq("event_id",event.id).eq("status","accepted");
      if(error||!event.participants.every(p=>p.accountId&&invitations?.some(i=>i.participant_id===p.id&&i.invitee_id===p.accountId)))throw new Error("Every selected participant must accept their event invitation before preparation.");
      const active=await db.from("bourbon_profiles").select("id").in("id",event.participants.map(p=>p.accountId)).eq("status","active");if(active.error||active.data?.length!==event.participants.length)throw new Error("Every participant must have an active approved profile.");
    }
    if(c.type==="roster-seat"){
      if(!isEventAdmin(event,a))throw new Error("Only event admins can save participants.");
      if(c.accountId){const profile=await getProfile(db,String(c.accountId));if(profile?.status!=="active")throw new Error("Select an approved member.");Object.assign(c,profileNames(profile),{email:profile.email});}
    }
    if (c.type === "setup") {
      if (!isEventAdmin(event,a))
        return json(
          { error: "Only the event host can set up participants." },
          403,
        );
      if (Array.isArray(c.participants))
        for (const participant of c.participants) {
          if (participant.accountId) {
            const profile = await getProfile(db, participant.accountId);
            if (profile?.status !== "active")
              throw new Error("Select an active community member.");
            participant.email = profile.email;
            participant.name = profile.display_name;
          }
        }
    }
    const next = applyCommand(event, a, c);
    const { data: saved, error: saveError } = await db.rpc(
      next.workflowVersion===2?"save_bourbon_enrollment_event":"save_bourbon_community_event",
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
