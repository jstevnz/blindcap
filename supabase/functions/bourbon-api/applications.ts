import type { SupabaseClient } from "@supabase/supabase-js";
import {
  profileFields,
  privateProfileFields,
  checkPassword,
} from "./community-shared.ts";
type Services = {
  limit: (key: string, count: number, seconds?: number) => Promise<void>;
  deliver: (
    to: string,
    subject: string,
    text: string,
    key: string,
  ) => Promise<boolean>;
};
export async function notifyOwner(
  db: SupabaseClient,
  id: string,
  deliver: Services["deliver"],
) {
  try {
    const { data: p, error } = await db
      .from("bourbon_profiles")
      .select("*")
      .eq("id", id)
      .eq("status", "pending")
      .maybeSingle();
    if (error || !p) return false;
    if (p.admin_notified_at) return true;
    const { data: owner, error: ownerError } = await db
      .from("bourbon_profiles")
      .select("email")
      .eq("role", "owner")
      .eq("status", "active")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (ownerError || !owner?.email) return false;
    await deliver(
      owner.email,
      "Blindcap: a new signup needs your review",
      `A new Blindcap signup is awaiting your review.\n\nName: ${p.full_name || p.display_name}\nDisplay name: ${p.display_name}\nEmail: ${p.email}\nPhone: ${p.phone || "Not provided"}\nCity/state: ${p.location || "Not provided"}\n\nReview the profile, check email verification, then approve or delete it:\nhttps://blindcap.net/members\n\nThis account cannot host events or appear in member searches until you approve it.`,
      id + ":signup-review",
    );
    const { error: saved } = await db
      .from("bourbon_profiles")
      .update({ admin_notified_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "pending");
    return !saved;
  } catch {
    return false;
  }
}
export async function applyForMembership(
  input: Record<string, unknown>,
  db: SupabaseClient,
  req: Request,
  services: Services,
) {
  if (input.website) throw new Error("Unable to submit this signup.");
  const email = String(input.email ?? "")
    .trim()
    .toLowerCase();
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.length > 254 ||
    email.endsWith("@guests.blindcap.invalid")
  )
    throw new Error("Enter a valid personal email address.");
  const fields = {
    ...profileFields(input),
    ...privateProfileFields(input, true),
  };
  checkPassword(input.password);
  await services.limit("signup-hourly", 100, 3600);
  await services.limit(
    "signup-ip:" + (req.headers.get("x-blindcap-client-ip") ?? "direct"),
    25,
    3600,
  );
  await services.limit("signup-email:" + email, 2, 300);
  if (!req.headers.get("x-blindcap-email-key"))
    throw new Error("Account email delivery is not configured.");
  const { data: existing, error: existingError } = await db
    .from("bourbon_profiles")
    .select("*")
    .eq("email", email)
    .maybeSingle();
  if (existingError) throw new Error("Unable to check this signup.");
  if (existing && existing.status !== "pending")
    return { applicationSubmitted: true, existingRegistration: true };
  let userId = existing?.id as string | undefined;
  if (!userId) {
    await services.limit("signup-new-daily", 25, 86400);
    const { data: created, error } = await db.auth.admin.createUser({
      email,
      password: input.password,
      email_confirm: false,
      app_metadata: { blindcap_managed: true },
    });
    if (error || !created.user)
      throw new Error(
        "Unable to create this account. If you have registered before, use Sign in or an email sign-in link.",
      );
    userId = created.user.id;
    let claimGuestId: string | null = null;
    const bearer = req.headers.get("authorization");
    if (bearer?.startsWith("Bearer ")) {
      const { data } = await db.auth.getUser(bearer.slice(7));
      if (data.user?.email?.endsWith("@guests.blindcap.invalid"))
        claimGuestId = data.user.id;
    }
    const { error: profileError } = await db.from("bourbon_profiles").insert({
      id: userId,
      email,
      username: email,
      ...fields,
      status: "pending",
      role: "member",
      signup_source: "application",
      claim_guest_id: claimGuestId,
    });
    if (profileError) {
      await db.auth.admin.deleteUser(userId);
      throw new Error("Unable to save this profile. Please try again.");
    }
  }
  const id = userId!;
  const verification = async () => {
    await services.limit("signup-verification-daily", 50, 86400);
    const { data: link, error } = await db.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (error || !link.properties?.hashed_token)
      throw new Error("Unable to create a verification email.");
    await services.deliver(
      email,
      "Verify your Blindcap signup",
      `Hi ${existing?.display_name ?? fields.display_name},\n\nVerify your email to finish your Blindcap signup:\nhttps://blindcap.net/account/confirm#token_hash=${link.properties.hashed_token}&type=email\n\nYour profile will stay pending until the community owner approves it. After verifying your email, you can sign in and see your approval status.\n\nIf you did not request this account, ignore this message.`,
      id + ":verify:" + link.properties.hashed_token,
    );
  };
  const [verified, notified] = await Promise.allSettled([
    verification(),
    notifyOwner(db, id, services.deliver),
  ]);
  return {
    applicationSubmitted: true,
    pendingApproval: true,
    verificationSent: verified.status === "fulfilled",
    adminNotificationPending:
      notified.status !== "fulfilled" || !notified.value,
    ...(existing ? { existingRegistration: true } : {}),
  };
}
