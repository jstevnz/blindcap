import { backend, checkOrigin, body, failure } from "@/lib/server";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(_: Request, ctx: Context) {
  try {
    return await backend({ action: "get", id: (await ctx.params).id });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: Request, ctx: Context) {
  try {
    checkOrigin(req);
    return await backend({
      action: "command",
      id: (await ctx.params).id,
      command: await body(req),
    });
  } catch (e) {
    return failure(e);
  }
}
