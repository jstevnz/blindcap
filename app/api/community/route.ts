import { backend, body, checkOrigin, failure } from "@/lib/server";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const input = await body(req);
    const op = input.operation;
    const publicAction = [
      "invitation",
      "register",
      "apply",
      "login",
      "recover",
      "email-login",
    ].includes(op);
    return await backend(
      { ...input, action: "community" },
      {
        public: publicAction,
        email: [
          "register",
          "apply",
          "self",
          "enroll",
          "pending-members",
          "review-member",
          "resend-verification",
          "invitations",
          "recover",
          "email-login",
          "community-invite",
        ].includes(op),
        clientIp:
          req.headers.get("x-vercel-forwarded-for") ??
          req.headers.get("x-forwarded-for")?.split(",")[0] ??
          "unknown",
      },
    );
  } catch (e) {
    return failure(e);
  }
}
