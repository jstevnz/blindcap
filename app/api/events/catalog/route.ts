import { backend, failure } from "@/lib/server";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return await backend({ action: "catalog" });
  } catch (e) {
    return failure(e);
  }
}
