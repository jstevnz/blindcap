import { backend, checkOrigin, failure } from "@/lib/server";
export const dynamic = "force-dynamic";
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    checkOrigin(req);
    return await backend({ action: "mailing-list", id: (await ctx.params).id });
  } catch (e) {
    return failure(e);
  }
}
