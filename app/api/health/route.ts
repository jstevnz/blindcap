export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/bourbon-api`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        },
        body: JSON.stringify({ action: "health" }),
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      },
    );
    const result = await response.json();
    const ok = response.ok && result.ok === true;
    return Response.json({ ok }, {
      status: ok ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json({ ok: false }, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
