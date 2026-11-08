import { backend, body, checkOrigin, failure } from "@/lib/server";
import { createHash } from "node:crypto";
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    checkOrigin(req);
    const input = await body(req);
    const details = await backend({
      action: "member-email-details",
      id: (await params).id,
      participantId: input.participantId,
    });
    if (!details.ok) return details;
    const d = await details.json();
    if (!process.env.RESEND_API_KEY)
      throw new Error("Email sending is not configured.");
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key":
          "blindcap-member/" +
          createHash("sha256")
            .update(JSON.stringify([d.eventId, d.participantId, d.email]))
            .digest("hex"),
      },
      body: JSON.stringify({
        from: "Blindcap <invitations@blindcap.net>",
        to: [d.email],
        subject: `Blindcap event invitation: ${String(d.eventTitle).replace(/[\r\n]/g, " ")}`,
        text: `Hi ${d.name},\n\nYou’re invited to ${d.eventTitle}. Sign in to your Blindcap account, then accept the invitation from your dashboard:\nhttps://blindcap.net/\n\nAccepting assigns you your own tasting seat and saves the event in your history.\n\nBlindcap`,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok)
      throw new Error(
        "The email service could not accept this invitation. Please try again later.",
      );
    return Response.json(
      { accepted: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
