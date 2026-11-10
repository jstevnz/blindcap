import { backend, body, checkOrigin, failure } from "@/lib/server";
export const dynamic = "force-dynamic";
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    checkOrigin(req);
    const input = await body(req);
    return await backend(
      { ...input, action: "enrollment", id: (await ctx.params).id },
      { email: input.operation === "send" },
    );
  } catch (e) {
    return failure(e);
  }
}
