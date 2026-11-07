import { body, checkOrigin, failure } from "@/lib/server";
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const input = await body(req);
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/bourbon-api`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        },
        body: JSON.stringify({ action: "redeem", token: input.token }),
        cache: "no-store",
      },
    );
    return Response.json(await res.json(), {
      status: res.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return failure(e);
  }
}
