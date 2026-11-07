import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
export async function GET(req: Request) {
  const url = new URL(req.url),
    code = url.searchParams.get("code");
  if (code) {
    const jar = await cookies();
    const s = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll: () => jar.getAll(),
          setAll: (vs) =>
            vs.forEach(({ name, value, options }) =>
              jar.set(name, value, options),
            ),
        },
      },
    );
    const { error } = await s.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL("/", url.origin));
  }
  return NextResponse.redirect(new URL("/?auth=expired", url.origin));
}
