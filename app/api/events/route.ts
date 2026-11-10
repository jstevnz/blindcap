import { backend, checkOrigin, body, failure } from "@/lib/server";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return await backend({ action: "list" });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const data = await body(req);
    return await backend({
      action: "create",
      title: data.title,
      eventType:data.eventType,
      tasterCount: data.tasterCount,
    });
  } catch (e) {
    return failure(e);
  }
}
