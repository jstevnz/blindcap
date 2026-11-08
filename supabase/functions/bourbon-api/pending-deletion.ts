import type { SupabaseClient } from "@supabase/supabase-js";
// Keep the existing Auth/profile foreign key. Only an authorized pending application
// is disabled and removed before calling Auth; a failed Auth cleanup restores a
// disabled profile. No Auth-table DELETE grants or cascading schema changes are needed.
export async function deletePendingApplication(
  db: SupabaseClient,
  actorId: string,
  targetId: unknown,
  username: unknown,
) {
  const { data: owner, error: ownerError } = await db
    .from("bourbon_profiles")
    .select("id")
    .eq("id", actorId)
    .eq("role", "owner")
    .eq("status", "active")
    .maybeSingle();
  if (ownerError || !owner)
    throw new Error("Only the active community owner can delete signups.");
  const { data: target, error } = await db
    .from("bourbon_profiles")
    .select("*")
    .eq("id", targetId)
    .eq("username", username)
    .eq("role", "member")
    .is("approved_at", null)
    .in("status", ["pending", "suspended"])
    .maybeSingle();
  if (error || !target)
    throw new Error(
      "The signup changed or is already approved. Refresh the review list.",
    );
  const id = target.id as string;
  const related = await Promise.all([
    db.from("bourbon_events").select("id").eq("owner_id", id).limit(1),
    db
      .from("bourbon_guest_access")
      .select("event_id")
      .eq("auth_user_id", id)
      .limit(1),
    db
      .from("bourbon_member_invites")
      .select("participant_id")
      .or(`invitee_id.eq.${id},invited_by.eq.${id}`)
      .limit(1),
    db
      .from("bourbon_community_invites")
      .select("id")
      .eq("invited_by", id)
      .limit(1),
  ]);
  if (related.some((r) => r.error))
    throw new Error("Unable to check this account’s event records.");
  if (related.some((r) => r.data?.length))
    throw new Error(
      "This account has event records and cannot be deleted as a pending signup.",
    );
  const { data: disabled, error: disableError } = await db
    .from("bourbon_profiles")
    .update({ status: "suspended", discoverable: false })
    .eq("id", id)
    .eq("username", username)
    .eq("role", "member")
    .eq("status", target.status)
    .is("approved_at", null)
    .select("*")
    .maybeSingle();
  if (disableError || !disabled)
    throw new Error("The signup changed. Refresh the review list.");
  const { error: inviteError } = await db
    .from("bourbon_community_invites")
    .delete()
    .or(`reserved_user_id.eq.${id},claim_guest_id.eq.${id}`);
  if (inviteError)
    throw new Error(
      "This signup is disabled. Refresh and retry deletion to finish invitation cleanup.",
    );
  const { data: removed, error: removeError } = await db
    .from("bourbon_profiles")
    .delete()
    .eq("id", id)
    .eq("username", username)
    .eq("role", "member")
    .eq("status", "suspended")
    .is("approved_at", null)
    .select("id")
    .maybeSingle();
  if (removeError || !removed)
    throw new Error(
      "This signup is disabled. Refresh and retry deletion to finish profile cleanup.",
    );
  try {
    const { error: authError } = await db.auth.admin.deleteUser(id);
    if (authError && authError.code !== "user_not_found") throw authError;
  } catch {
    await db
      .from("bourbon_profiles")
      .upsert(
        { ...disabled, status: "suspended", discoverable: false },
        { onConflict: "id", ignoreDuplicates: true },
      );
    throw new Error(
      "The signup is disabled, but sign-in cleanup could not finish. Refresh and retry deletion.",
    );
  }
}
