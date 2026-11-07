import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
export async function backend(data: unknown) {
  const jar = await cookies();
  const s = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (values) =>
          values.forEach(({ name, value, options }) =>
            jar.set(name, value, options),
          ),
      },
    },
  );
  const { data: verified, error } = await s.auth.getUser();
  if (error || !verified.user?.email_confirmed_at)
    return Response.json(
      { error: "Please sign in with your verified email." },
      { status: 401 },
    );
  const { data: session } = await s.auth.getSession();
  if (!session.session)
    return Response.json({ error: "Please sign in." }, { status: 401 });
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/bourbon-api`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.session.access_token}`,
        apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      },
      body: JSON.stringify(data),
      cache: "no-store",
    },
  );
  const result = await res.json();
  return Response.json(result, {
    status: res.status,
    headers: { "Cache-Control": "no-store" },
  });
}
export function checkOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin || origin !== new URL(req.url).origin)
    throw new Error("This request must come from the application.");
}
export async function body(req: Request) {
  const text = await req.text();
  if (text.length > 64000) throw new Error("Request is too large.");
  return JSON.parse(text);
}
export function failure(e: unknown) {
  return Response.json(
    {
      error:
        e instanceof SyntaxError
          ? "Invalid request."
          : e instanceof Error
            ? e.message
            : "Unable to complete this request.",
    },
    { status: 400, headers: { "Cache-Control": "no-store" } },
  );
}
