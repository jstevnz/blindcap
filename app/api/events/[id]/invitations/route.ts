import { backend, body, checkOrigin, failure } from "@/lib/server";
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    checkOrigin(req);
    const input = await body(req);
    return await backend({
      action: "invite",
      id: (await params).id,
      participantId: input.participantId,
    });
  } catch (e) {
    return failure(e);
  }
}
