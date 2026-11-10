import type { SupabaseClient } from "@supabase/supabase-js";
import { isEventAdmin, type Event, type Actor } from "./engine.ts";
import type { Profile } from "./community-shared.ts";
export function canManageTeam(e: Event, a: Actor, p: Profile | null) {
  return p?.status === "active" && (e.ownerId === a.id || p.role === "owner");
}
export function setCoAdmins(
  e: Event,
  a: Actor,
  p: Profile | null,
  ids: unknown,
  revision: unknown,
): Event {
  if (!canManageTeam(e, a, p))
    throw new Error(
      "Only the primary host or site owner can change event admins.",
    );
  if (revision !== e.revision)
    throw new Error("The event changed. Refresh before changing admins.");
  if (
    !Array.isArray(ids) ||
    ids.length > 8 ||
    !ids.every(
      (id) =>
        typeof id === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          id,
        ),
    ) ||
    new Set(ids).size !== ids.length
  )
    throw new Error("Choose up to eight distinct approved co-admins.");
  if (ids.includes(e.ownerId))
    throw new Error("The primary host already has admin access.");
  return { ...structuredClone(e), adminIds: ids, revision: e.revision + 1 };
}
export async function eventTeam(
  db: SupabaseClient,
  e: Event,
  a: Actor,
  p: Profile | null,
) {
  if (!isEventAdmin(e, a) && !canManageTeam(e, a, p))
    throw new Error("Only event admins can view the host team.");
  const { data, error } = await db
    .from("bourbon_profiles")
    .select("id,display_name,status")
    .in("id", [e.ownerId, ...(e.adminIds ?? [])]);
  if (error) throw new Error("Unable to load event admins.");
  return {
    revision: e.revision,
    canManage: canManageTeam(e, a, p),
    primaryHostId: e.ownerId,
    admins: (data ?? []).map((r) => ({
      id: r.id,
      name: r.display_name,
      status: r.status,
      primary: r.id === e.ownerId,
    })),
  };
}
export function confirmedProfileIds(
  e: Event,
  invitations: { participant_id: string; invitee_id: string; status: string }[],
) {
  return e.participants
    .filter(
      (p) =>
        p.accountId &&
        invitations.some(
          (i) =>
            i.participant_id === p.id &&
            i.invitee_id === p.accountId &&
            i.status === "accepted",
        ),
    )
    .map((p) => p.accountId!);
}
export async function mailingList(db: SupabaseClient, e: Event, a: Actor) {
  if (!isEventAdmin(e, a))
    throw new Error("Only this event’s admins can request mailing addresses.");
  const { data: invites, error } = await db
    .from("bourbon_member_invites")
    .select("participant_id,invitee_id,status")
    .eq("event_id", e.id);
  if (error) throw new Error("Unable to verify confirmed invitations.");
  const { data: grants, error: grantError } = await db
    .from("bourbon_guest_access")
    .select("participant_id,auth_user_id")
    .eq("event_id", e.id);
  if (grantError) throw new Error("Unable to verify guest confirmations.");
  const confirmed = new Map<string, string>();
  for (const p of e.participants) {
    if (
      p.accountId &&
      invites?.some(
        (i) =>
          i.participant_id === p.id &&
          i.invitee_id === p.accountId &&
          i.status === "accepted",
      )
    )
      confirmed.set(p.id, p.accountId);
    if (!p.accountId) {
      const grant = grants?.find((g) => g.participant_id === p.id);
      if (grant) confirmed.set(p.id, grant.auth_user_id);
    }
  }
  const ids = [...new Set(confirmed.values())];
  const profiles = ids.length
    ? await db
        .from("bourbon_profiles")
        .select("id,display_name,full_name,mailing_address")
        .in("id", ids)
        .eq("status", "active")
    : { data: [], error: null };
  if (profiles.error) throw new Error("Unable to load mailing addresses.");
  return {
    title: e.title,
    participants: e.participants.map((p) => {
      const profile = profiles.data?.find((x) => x.id === confirmed.get(p.id));
      return {
        participantId: p.id,
        name: p.name,
        confirmed: confirmed.has(p.id),
        fullName: profile?.full_name || profile?.display_name || p.name,
        address: profile?.mailing_address ?? null,
      };
    }),
  };
}
