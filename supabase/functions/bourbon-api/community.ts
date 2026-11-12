import {linkReserved,notifyEnrollmentForUser} from "./enrollment.ts";
import { seriesLogoUrl } from "./series-logos.ts";
import { avatarUrl } from "./photos.ts";
import { deletePendingApplication } from "./pending-deletion.ts";
import { applyForMembership, notifyOwner } from "./applications.ts";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomBytes, createHash } from "node:crypto";
import {
  profileFields,
  privateProfileFields,
  checkPassword,
  publicProfile,
  type Profile,
} from "./community-shared.ts";
import type { Actor } from "./engine.ts";
type Input = Record<string, unknown>;
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export async function rate(
  db: SupabaseClient,
  key: string,
  limit: number,
  seconds = 3600,
) {
  const { data, error } = await db.rpc("bourbon_take_rate", {
    p_key: hash(key),
    p_seconds: seconds,
    p_limit: limit,
  });
  if (error) throw new Error("Unable to check request limits.");
  if (!data)
    throw new Error("Too many requests. Please wait before trying again.");
}
export async function getProfile(db: SupabaseClient, id: string) {
  const { data, error } = await db
    .from("bourbon_profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Unable to load your community profile.");
  return data as Profile | null;
}
function active(p: Profile | null): asserts p is Profile {
  if (!p || p.status !== "active")
    throw new Error("An active private-community membership is required.");
}
export async function send(
  db: SupabaseClient,
  req: Request,
  to: string,
  subject: string,
  text: string,
  key: string,
) {
  const secret = req.headers.get("x-blindcap-email-key");
  if (!secret) throw new Error("Account email delivery is not configured.");
  await rate(db, "account-email-daily", 75, 86400);
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
      "Idempotency-Key": "blindcap-account/" + hash(key),
    },
    body: JSON.stringify({
      from: "Blindcap <invitations@blindcap.net>",
      to: [to],
      subject,
      text,
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok)
    throw new Error(
      "The email service could not accept this message. Please try again later.",
    );
  return true;
}
async function invitation(db: SupabaseClient, token: unknown) {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token))
    throw new Error("Open a valid private community invitation.");
  const { data, error } = await db
    .from("bourbon_community_invites")
    .select("*")
    .eq("token_hash", hash(token))
    .is("redeemed_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error || !data)
    throw new Error(
      "This community invitation has expired or was used. Ask the community owner for a new one.",
    );
  return data;
}
export async function communityAction(
  input: Input,
  db: SupabaseClient,
  a: Actor | null,
  req: Request,
) {
  const services = {
    limit: (key: string, count: number, seconds?: number) =>
      rate(db, key, count, seconds),
    deliver: (to: string, subject: string, text: string, key: string) =>
      send(db, req, to, subject, text, key),
  };
  const op = input.operation;
  if (op === "apply") return await applyForMembership(input, db, req, services);
  const source = req.headers.get("x-blindcap-client-ip") ?? "direct";
  if (op === "invitation") {
    await rate(db, "invite-view:" + source, 40);
    const i = await invitation(db, input.token);
    return { email: i.email };
  }
  if (op === "register") {
    await rate(db, "register:" + source, 10);
    const i = await invitation(db, input.token);
    await rate(db, "register-invite:" + i.id, 5);
    if (!req.headers.get("x-blindcap-email-key"))
      throw new Error("Account email delivery is not configured.");
    const fields = profileFields(input);
    checkPassword(input.password);
    const { data: existing } = await db
      .from("bourbon_profiles")
      .select("*")
      .eq("email", i.email)
      .maybeSingle();
    if (existing && existing.status !== "pending")
      throw new Error(
        "An account already exists for this invitation email. Sign in to join.",
      );
    let userId = existing?.id as string | undefined;
    if (userId) {
      if (i.reserved_user_id !== userId)
        throw new Error(
          "Sign in with your existing email account to finish joining.",
        );
      // A resend must never reset a pending account's password or profile.
      // Only verified recovery or an authenticated account can change credentials.
    } else {
      const { data: created, error } = await db.auth.admin.createUser({
        email: i.email,
        password: input.password,
        email_confirm: false,
        app_metadata: { blindcap_managed: true },
      });
      if (error || !created.user)
        throw new Error(
          "This email may already have an account. Sign in with an email link to finish joining.",
        );
      userId = created.user.id;
      const { error: profileError } = await db.from("bourbon_profiles").insert({
        id: userId,
        email: i.email,
        username: i.email,
        ...fields,
        ...privateProfileFields(input),
        status: "pending",
        role: "member",
      });
      if (profileError) {
        await db.auth.admin.deleteUser(userId);
        throw new Error(
          "Unable to save this profile. Please try again.",
        );
      }
    }
    let claimGuestId: string | null = i.claim_guest_id ?? null;
    const bearer = req.headers.get("authorization");
    if (bearer?.startsWith("Bearer ")) {
      const { data } = await db.auth.getUser(bearer.slice(7));
      if (data.user?.email?.endsWith("@guests.blindcap.invalid"))
        claimGuestId = data.user.id;
    }
    const { data: reserved, error: reserveError } = await db
      .from("bourbon_community_invites")
      .update({ reserved_user_id: userId, claim_guest_id: claimGuestId })
      .eq("id", i.id)
      .is("redeemed_at", null)
      .gt("expires_at", new Date().toISOString())
      .select("id")
      .maybeSingle();
    if (reserveError || !reserved)
      throw new Error(
        "The invitation changed. Ask the owner for a replacement.",
      );
    const { data: link, error: linkError } = await db.auth.admin.generateLink({
      type: "magiclink",
      email: i.email,
    });
    if (linkError || !link.properties?.hashed_token)
      throw new Error("Unable to create the verification message.");
    const url = `https://blindcap.net/account/confirm#token_hash=${link.properties.hashed_token}&type=email`;
    try {
      await send(
        db,
        req,
        i.email,
        "Verify your Blindcap account",
        `Hi ${existing?.display_name ?? fields.display_name},\n\nVerify your email to finish joining the private Blindcap community:\n${url}\n\nAfter verifying, your profile stays pending until the community owner approves it. You can sign in and edit your profile while waiting.\n\nIf you did not request this account, ignore this email.`,
        userId + ":verify:" + link.properties.hashed_token,
      );
    } finally {
      await notifyOwner(db, userId!, services.deliver);
    }
    return existing
      ? { verificationSent: true, existingRegistration: true }
      : { verificationSent: true };
  }
  if (op === "login") {
    await rate(db, "login-ip:" + source, 30, 900);
    const email = String(input.email ?? input.identifier ?? "")
      .trim()
      .toLowerCase();
    await rate(db, "login-account:" + email, 10, 900);
    if (typeof input.password !== "string" || input.password.length > 128 ||
        email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new Error("Email or password is incorrect.");
    const { data: profile } = await db.from("bourbon_profiles")
      .select("email,status").eq("email", email).maybeSingle();
    if (!profile || !["active", "pending"].includes(profile.status))
      throw new Error("Email or password is incorrect.");
    const client = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data, error } = await client.auth.signInWithPassword({
      email: profile.email,
      password: input.password,
    });
    if (profile.status === "pending" && error?.code === "email_not_confirmed")
      return { verificationRequired: true };
    if (error || !data.session)
      throw new Error("Email or password is incorrect.");
    return {
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      },
    };
  }
  if (op === "recover" || op === "email-login") {
    await rate(db, "recovery-ip:" + source, 6);
    const email = String(input.email ?? "")
      .trim()
      .toLowerCase();
    await rate(db, "recovery-email:" + email, 2, 300);
    const { data: profile } = await db
      .from("bourbon_profiles")
      .select("status")
      .eq("email", email)
      .maybeSingle();
    if (profile?.status === "suspended") return { sent: true };
    if (!profile) {
      if (op !== "email-login") return { sent: true };
      const { data: invited } = await db
        .from("bourbon_community_invites")
        .select("id")
        .eq("email", email)
        .is("redeemed_at", null)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      if (!invited) return { sent: true };
    }
    const kind = op === "recover" ? "recovery" : "magiclink";
    const { data: link, error } = await db.auth.admin.generateLink({
      type: kind,
      email,
    });
    if (error || !link.properties?.hashed_token) return { sent: true };
    const type = op === "recover" ? "recovery" : "email";
    const url = `https://blindcap.net/account/confirm#token_hash=${link.properties.hashed_token}&type=${type}`;
    await send(
      db,
      req,
      email,
      op === "recover" ? "Reset your Blindcap password" : "Sign in to Blindcap",
      `Use this private link to ${op === "recover" ? "reset your password" : "sign in"}:\n${url}\n\nIf you did not request this email, ignore it.`,
      email + ":" + kind + ":" + link.properties.hashed_token,
    );
    return { sent: true };
  }
  if (!a) throw new Error("Please sign in with your verified email.");
  let p = await getProfile(db, a.id);
  if (op === "self") {
    if (p?.status === "pending") await notifyOwner(db, a.id, services.deliver);
    return {
      profile: p
        ? {
            ...publicProfile(p),
            avatarUrl: await avatarUrl(db,p.avatar_path),
            email: p.email,
            fullName: p.full_name ?? "",
            firstName: p.first_name ?? (p.full_name ?? "").trim().split(/\s+/)[0] ?? "",
            lastName: p.last_name ?? (p.full_name ?? "").trim().split(/\s+/).slice(1).join(" "),
            phone: p.phone ?? "",
            location: p.location ?? "",
            mailingAddress: p.mailing_address ?? {},
            discoverable: p.discoverable,
            role: p.role,
            status: p.status,
          }
        : null,
      guest: a.email.endsWith("@guests.blindcap.invalid"),
    };
  }
  if (op === "enroll") {
    const i = await invitation(db, input.token);
    if (i.email !== a.email)
      throw new Error(
        "Sign in with the email this community invitation was sent to.",
      );
    if (p?.status === "active") return { joined: true };
    if (p?.status === "suspended")
      throw new Error("Your community membership is suspended.");
    const fields = profileFields(input);
    const { error } = await db.from("bourbon_profiles").upsert(
      {
        id: a.id,
        email: a.email,
        username: a.email,
        ...fields,
        ...privateProfileFields(input),
        status: "pending",
        role: "member",
      },
      { onConflict: "id" },
    );
    if (error) throw new Error("Unable to save this profile.");
    const { data: reserved, error: reserveError } = await db
      .from("bourbon_community_invites")
      .update({ reserved_user_id: a.id })
      .eq("id", i.id)
      .is("redeemed_at", null)
      .gt("expires_at", new Date().toISOString())
      .select("id")
      .maybeSingle();
    if (reserveError || !reserved)
      throw new Error("Unable to reserve this invitation.");
    await notifyOwner(db, a.id, services.deliver);
    return { pendingApproval: true };
  }
  if (op === "profile") {
    if (!p || !["active", "pending"].includes(p.status))
      throw new Error("An eligible account is required.");
    const fields = { ...profileFields(input), ...privateProfileFields(input) };
    const { error } = await db
      .from("bourbon_profiles")
      .update(fields)
      .eq("id", a.id);
    if (error) throw new Error("Unable to save your profile.");
    return { saved: true };
  }
  active(p);
  if (op === "search") {
    const term = String(input.query ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9 _-]/g, "");
    if (term.length < 2) return { profiles: [] };
    const pattern = "%" + term.replace(/[_%]/g, "\\$&") + "%";
    const { data, error } = await db
      .from("bourbon_profiles")
      .select("*")
      .eq("status", "active")
      .eq("discoverable", true)
      .or(`display_name.ilike.${pattern},full_name.ilike.${pattern}`)
      .limit(10);
    if (error) throw new Error("Unable to search community profiles.");
    return { profiles: await Promise.all((data ?? []).map(async (x) => ({...publicProfile(x as Profile),avatarUrl:await avatarUrl(db,x.avatar_path)}))) };
  }
  if (op === "invitations") {
    await linkReserved(db,a.id);
    if (input.notify !== false && req.headers.get("x-blindcap-email-key")) {
      await notifyEnrollmentForUser(db, a.id, services.deliver);
    }
    const { data, error } = await db
      .from("bourbon_member_invites")
      .select("event_id,participant_id,status,invited_by,created_at")
      .eq("invitee_id", a.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .order("event_id", { ascending: true });
    if (error) throw new Error("Unable to load invitations.");
    const list = await Promise.all((data ?? []).map(async (invite) => {
      const [{ data: event }, { data: host }, { data: edition }] = await Promise.all([
        db.from("bourbon_events").select("state").eq("id", invite.event_id).maybeSingle(),
        db.from("bourbon_profiles").select("display_name").eq("id", invite.invited_by).maybeSingle(),
        input.includeLogo === true
          ? db.from("bourbon_editions").select("series_id").eq("event_id", invite.event_id).maybeSingle()
          : { data: null },
      ]);
      if (!event) return null;
      const series = edition
        ? (await db.from("bourbon_series").select("logo_path").eq("id", edition.series_id).maybeSingle()).data
        : null;
      return {
        ...invite,
        title: event.state.title,
        host: host?.display_name ?? "Your host",
        logoUrl: await seriesLogoUrl(db, series?.logo_path),
      };
    }));
    return { invitations: list.filter((invite) => invite !== null) };
  }
  if (op === "accept") {
    const { data, error } = await db.rpc("bourbon_accept_member_invite", {
      p_event: input.eventId,
      p_seat: input.participantId,
      p_user: a.id,
    });
    if (error || !data)
      throw new Error("Unable to accept this invitation. It may have changed.");
    return { accepted: true };
  }
  if (op === "decline") {
    const { error } = await db
      .from("bourbon_member_invites")
      .update({ status: "declined" })
      .eq("event_id", input.eventId)
      .eq("participant_id", input.participantId)
      .eq("invitee_id", a.id)
      .eq("status", "pending");
    if (error) throw new Error("Unable to decline this invitation.");
    return { declined: true };
  }
  if (p.role !== "owner")
    throw new Error(
      "Only the community owner can invite new community members.",
    );
  if (op === "participant-directory") {
    const participants = [];
    const pageSize = 200;
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await db.from("bourbon_profiles")
        .select("id,first_name,last_name,full_name,display_name,email,status,created_at,avatar_path")
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(offset, offset + pageSize - 1);
      if (error) throw new Error("Unable to load the participant directory.");
      participants.push(...(data ?? []));
      if (!data || data.length < pageSize) break;
    }
    return {
      participants: await Promise.all(participants.map(async ({ avatar_path, ...person }) => ({
        ...person,
        avatarUrl: await avatarUrl(db, avatar_path),
      }))),
    };
  }
  if (op === "pending-members") {
    const { data, error } = await db.rpc("pending_bourbon_members", {
      p_actor: a.id,
    });
    if (error) throw new Error("Unable to load signup reviews.");
    await Promise.allSettled(
      (data ?? [])
        .filter(
          (x: { admin_notified_at: string | null }) => !x.admin_notified_at,
        )
        .slice(0, 5)
        .map((applicant: { id: string }) =>
          notifyOwner(db, applicant.id, services.deliver),
        ),
    );
    const { data: retry, error: retryError } = await db
      .from("bourbon_profiles")
      .select(
        "id,username,display_name,full_name,email,phone,location,bio,created_at,signup_source,admin_notified_at,status",
      )
      .eq("role", "member")
      .eq("status", "suspended")
      .is("approved_at", null)
      .order("created_at", { ascending: true })
      .limit(100);
    if (retryError) throw new Error("Unable to load pending cleanup attempts.");
    return {
      applications: [
        ...(data ?? []).map((x: Record<string, unknown>) => ({
          ...x,
          status: "pending",
        })),
        ...(retry ?? []).map((x) => ({ ...x, verified: false })),
      ],
    };
  }
  if (op === "review-member") {
    if (
      !["approve", "delete"].includes(String(input.decision)) ||
      (input.decision === "delete" && input.confirmed !== true)
    )
      throw new Error("Confirm the signup review action.");
    if (input.decision === "delete") {
      await deletePendingApplication(db, a.id, input.userId, input.username);
      return { reviewed: true };
    }
    const { data, error } = await db.rpc("review_bourbon_member", {
      p_actor: a.id,
      p_target: input.userId,
      p_decision: input.decision,
      p_username: input.username,
    });
    if (error)
      throw new Error(
        error.message.includes("verify their email")
          ? "The applicant must verify their email before approval."
          : "Unable to review this signup. Please refresh the list.",
      );
    if (!data)
      throw new Error(
        "The signup or your permissions changed. Refresh the review list.",
      );
    try {await notifyEnrollmentForUser(db,String(input.userId),services.deliver);}catch{return {reviewed:true,eventInvitesPending:true};}
    return { reviewed: true };
  }
  if (op === "community-invites") {
    const { data, error } = await db
      .from("bourbon_community_invites")
      .select("id,email,expires_at,redeemed_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error("Unable to load community invitations.");
    return { invitations: data ?? [] };
  }
  if (op === "community-invite") {
    await rate(db, "community-invite:" + a.id, 20, 86400);
    const email = String(input.email ?? "")
      .trim()
      .toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
      throw new Error("Enter a valid invitation email.");
    const { data: existing } = await db
      .from("bourbon_profiles")
      .select("id,status")
      .eq("email", email)
      .maybeSingle();
    if (existing?.status === "active")
      throw new Error(
        "That person is already a member. Select their profile in event setup.",
      );
    const token = randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 7 * 86400000).toISOString();
    const { error } = await db.from("bourbon_community_invites").upsert(
      {
        email,
        token_hash: hash(token),
        invited_by: a.id,
        expires_at: expires,
        redeemed_at: null,
        reserved_user_id: existing?.id ?? null,
        claim_guest_id: null,
        created_at: new Date().toISOString(),
      },
      { onConflict: "email" },
    );
    if (error) throw new Error("Unable to create the community invitation.");
    if (input.sendEmail === true) {
      await send(
        db,
        req,
        email,
        "You’re invited to the private Blindcap community",
        `You’re invited to join Blindcap. Create your private account here:\nhttps://blindcap.net/register#invite=${token}\n\nThis invitation is for ${email} and expires in seven days. Members can host their own events, accept event invitations and keep a personal tasting history.\n\nKeep this link private.`,
        token + ":community",
      );
      return { emailed: true };
    }
    return { url: `https://blindcap.net/register#invite=${token}` };
  }
  if (op === "revoke") {
    const { error } = await db
      .from("bourbon_community_invites")
      .update({ expires_at: new Date().toISOString() })
      .eq("id", input.inviteId)
      .is("redeemed_at", null);
    if (error) throw new Error("Unable to revoke the invitation.");
    return { revoked: true };
  }
  throw new Error("Unknown community action.");
}
