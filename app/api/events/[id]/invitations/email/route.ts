import { backend, body, checkOrigin, failure } from "@/lib/server";
import {
  deliverInvitation,
  type InvitationDetails,
} from "@/lib/invitation-email";
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    checkOrigin(req);
    const input = await body(req);
    const verified = await backend({
      action: "invite-details",
      id: (await params).id,
      participantId: input.participantId,
      token: input.token,
    });
    if (!verified.ok) return verified;
    const details = (await verified.json()) as InvitationDetails;
    const result = await deliverInvitation(
      details,
      input.token,
      process.env.RESEND_API_KEY ?? "",
    );
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return failure(e);
  }
}
