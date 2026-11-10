import { backend, body, checkOrigin, failure } from "@/lib/server";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    return await backend({ ...(await body(req)), action: "series" });
  } catch (e) {
    return failure(e);
  }
}
