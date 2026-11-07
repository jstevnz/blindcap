import { createHash } from "node:crypto";
export type InvitationDetails = {
  eventId: string;
  participantId: string;
  eventTitle: string;
  name: string;
  email: string;
  expiresAt: string;
};
export function invitationMessage(details: InvitationDetails, token: string) {
  if (!/^[a-f0-9]{64}$/.test(token))
    throw new Error("Create a valid private invitation first.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(details.email))
    throw new Error("Save a valid email address for this taster first.");
  const link = `https://blindcap.net/join#invite=${token}`;
  const sender = "Blindcap <invitations@blindcap.net>";
  return {
    idempotencyKey:
      "blindcap-invite/" +
      createHash("sha256")
        .update(
          JSON.stringify([
            details.eventId,
            details.participantId,
            token,
            details.email,
            sender,
          ]),
        )
        .digest("hex"),
    payload: {
      from: sender,
      to: [details.email],
      subject: `Your Blindcap invitation: ${details.eventTitle.replace(/[\r\n]/g, " ")}`,
      text: `Hi ${details.name},\n\nYou’re invited to ${details.eventTitle} on Blindcap.\n\nOpen your private invitation on the device you’ll use for tasting, then select “Join the tasting”:\n${link}\n\nThis link works once and expires at ${new Date(details.expiresAt).toUTCString()}. Keep it private—it signs you into your assigned seat.\n\nIf you need a replacement, contact your event host.\n\nBlindcap\nTrust your taste.`,
    },
  };
}
export async function deliverInvitation(
  details: InvitationDetails,
  token: string,
  apiKey: string,
  transport: typeof fetch = fetch,
) {
  if (!apiKey)
    throw new Error(
      "Email sending is not configured yet. Your host can still copy and share the link.",
    );
  const message = invitationMessage(details, token);
  let response: Response;
  try {
    response = await transport("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": message.idempotencyKey,
      },
      body: JSON.stringify(message.payload),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new Error(
      "The email service did not confirm the send. Retry the same invitation; duplicate sends are protected for 24 hours.",
    );
  }
  if (!response.ok) {
    if (response.status === 429)
      throw new Error(
        "The email service’s sending limit was reached. Please try again later.",
      );
    throw new Error(
      "The email service could not accept this invitation. Check the sending domain and key, then retry.",
    );
  }
  const data = await response.json();
  if (typeof data.id !== "string")
    throw new Error(
      "The email service did not confirm the send. Retry the same invitation.",
    );
  return { messageId: data.id, email: details.email };
}
