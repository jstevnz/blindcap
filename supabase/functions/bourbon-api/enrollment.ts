import type { SupabaseClient } from "@supabase/supabase-js";
import { isEventAdmin, member, type Event, type Actor } from "./engine.ts";
export type Deliver = (
  to: string,
  subject: string,
  text: string,
  key: string,
) => Promise<unknown>;
export function profileNames(p: {
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string;
  display_name: string;
}) {
  const full = p.full_name?.trim() || p.display_name.trim();
  return {
    firstName: p.first_name || full.split(/\s+/)[0] || "",
    lastName: p.last_name || full.split(/\s+/).slice(1).join(" "),
  };
}
export async function linkReserved(db: SupabaseClient, userId: string) {
  const { error } = await db.rpc("link_bourbon_reserved_participants", {
    p_user: userId,
  });
  if (error)
    throw new Error("Unable to connect your reserved event invitations.");
}
export async function emailEnrollment(
  db: SupabaseClient,
  e: Event,
  deliver: Deliver,
  onlyUser?: string,
) {
  const outcomes: {
    participantId: string;
    name: string;
    sent: boolean;
    error?: string;
  }[] = [];
  for (const p of e.participants) {
    if (onlyUser && p.accountId !== onlyUser) continue;
    try {
      const table = p.accountId
          ? "bourbon_member_invites"
          : "bourbon_reserved_participants",
        field = p.accountId ? "email_sent_at" : "registration_sent_at";
      const { data: row, error } = await db
        .from(table)
        .select("*")
        .eq("event_id", e.id)
        .eq("participant_id", p.id)
        .maybeSingle();
      if (error || !row)
        throw new Error("Save this participant and publish invitations first.");
      if (row[field] || (p.accountId && row.status === "accepted")) {
        outcomes.push({ participantId: p.id, name: p.name, sent: true });
        continue;
      }
      const link = p.accountId
        ? `https://blindcap.net/event/${e.id}/welcome`
        : "https://blindcap.net/register";
      await deliver(
        p.email,
        `Blindcap invitation: ${e.title.replace(/[\r\n]/g, " ")}`,
        `Hi ${p.firstName ?? p.name},\n\nYou’re invited to ${e.title}.\n\n${p.accountId ? "Open your welcome page, sign in with this email, accept your event invitation, then enter the bottle name, distillery and proof you plan to bring." : `Create your Blindcap profile using the email address that received this message. Verify your email and wait for the community owner to approve your profile. Your event seat is reserved; once approved, you’ll receive an event invitation. Already have a profile? Sign in with this email to find the reserved invitation.`}\n\n${link}\n\nBottle identities stay hidden from other tasters. Your host can help update a bottle before the event begins.\n\nBlindcap`,
        `${e.id}:${p.id}:${p.accountId ? "event" : "registration"}`,
      );
      const { error: save } = await db
        .from(table)
        .update({ [field]: new Date().toISOString() })
        .eq("event_id", e.id)
        .eq("participant_id", p.id);
      if (save)
        throw new Error(
          "Email was accepted but its status could not be saved; retry is protected against duplicates.",
        );
      outcomes.push({ participantId: p.id, name: p.name, sent: true });
    } catch (error) {
      outcomes.push({
        participantId: p.id,
        name: p.name,
        sent: false,
        error:
          error instanceof Error ? error.message : "Unable to send invitation.",
      });
    }
  }
  return {
    outcomes,
    sent: outcomes.filter((x) => x.sent).length,
    failed: outcomes.filter((x) => !x.sent).length,
  };
}
export async function notifyEnrollmentForUser(
  db: SupabaseClient,
  userId: string,
  deliver: Deliver,
) {
  await linkReserved(db, userId);
  const { data: invites, error } = await db
    .from("bourbon_member_invites")
    .select("event_id")
    .eq("invitee_id", userId)
    .eq("status", "pending")
    .is("email_sent_at", null);
  if (error) throw new Error("Unable to load pending event invitations.");
  for (const id of [...new Set((invites ?? []).map((x) => x.event_id))]) {
    const { data } = await db
      .from("bourbon_events")
      .select("state")
      .eq("id", id)
      .maybeSingle();
    if (data?.state.workflowVersion === 2 && data.state.rosterInvited)
      await emailEnrollment(db, data.state, deliver, userId);
  }
}
export async function enrollmentAction(
  input: Record<string, any>,
  db: SupabaseClient,
  e: Event,
  a: Actor,
  deliver: Deliver,
) {
  if (e.workflowVersion !== 2)
    throw new Error("This event uses the original setup process.");
  if (input.operation === "welcome") {
    const admin = isEventAdmin(e, a),
      { data: invitation, error } = await db
        .from("bourbon_member_invites")
        .select("participant_id,status")
        .eq("event_id", e.id)
        .eq("invitee_id", a.id)
        .maybeSingle();
    if (error) throw new Error("Unable to verify your invitation.");
    if (!admin && !["pending", "accepted"].includes(invitation?.status ?? ""))
      throw new Error(
        "Sign in with the approved profile invited to this event.",
      );
    const seat = e.participants.find(
        (p) => p.id === invitation?.participant_id,
      ),
      b =
        invitation?.status === "accepted"
          ? e.bottles.find((b) => b.ownerId === seat?.id)
          : null;
    const { data: edition } = await db
      .from("bourbon_editions")
      .select("series_id")
      .eq("event_id", e.id)
      .maybeSingle();
    return {
      id: e.id,
      title: e.title,
      eventType: e.eventType ?? "bourbon-tasting",
      phase: e.phase,
      revision: e.revision,
      participantId: seat?.id ?? null,
      accepted: invitation?.status === "accepted",
      admin,
      seriesId: edition?.series_id ?? null,
      ownBottle: b
        ? { name: b.name, distillery: b.distillery ?? "", proof: b.proof ?? "" }
        : null,
      ready: e.phase !== "setup",
    };
  }
  if (!isEventAdmin(e, a))
    throw new Error("Only event admins can manage participant enrollment.");
  if (input.operation === "search") {
    const query = String(input.query ?? "")
      .trim()
      .slice(0, 80)
      .replace(/[^a-z0-9 _-]/gi, "");
    if (query.length < 2) return { profiles: [] };
    const pattern = "%" + query.replace(/[_%]/g, "\\$&") + "%";
    const { data, error } = await db
      .from("bourbon_profiles")
      .select("id,display_name,first_name,last_name,full_name")
      .eq("status", "active")
      .eq("discoverable", true)
      .or(
        `display_name.ilike.${pattern},full_name.ilike.${pattern},first_name.ilike.${pattern},last_name.ilike.${pattern}`,
      )
      .limit(10);
    if (error) throw new Error("Unable to search member profiles.");
    return {
      profiles: (data ?? []).map((p) => ({
        id: p.id,
        displayName: p.display_name,
        ...profileNames(p),
      })),
    };
  }
  if (input.operation === "profile") {
    const { data, error } = await db
      .from("bourbon_profiles")
      .select("id,display_name,first_name,last_name,full_name,email")
      .eq("id", input.profileId)
      .eq("status", "active")
      .eq("discoverable", true)
      .maybeSingle();
    if (error || !data)
      throw new Error("Select an available approved profile.");
    return {
      profile: { id: data.id, ...profileNames(data), email: data.email },
    };
  }
  if (input.operation === "send") {
    if (!e.rosterInvited)
      throw new Error(
        "Publish the saved participant list before emailing invitations.",
      );
    return emailEnrollment(db, e, deliver);
  }
  throw new Error("Unknown enrollment action.");
}
