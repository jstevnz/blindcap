import { backend, failure } from "@/lib/server";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return await backend({ action: "history" });
  } catch (e) {
    return failure(e);
  }
}
