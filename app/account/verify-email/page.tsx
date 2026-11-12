import VerificationEmailForm from "@/app/components/VerificationEmailForm";
import LoadingLink from "@/app/components/LoadingLink";

export default async function VerifyEmail({
  searchParams,
}: {
  searchParams: Promise<{ delivery?: string }>;
}) {
  const { delivery } = await searchParams;
  return (
    <main className="narrow">
      <section className="panel">
        <p className="eyebrow">Membership status</p>
        <h1>Verify your email</h1>
        <p role="status">
          {delivery === "sent"
            ? "A verification email was sent. Open it and click the link so an administrator can approve your profile."
            : delivery === "retry"
              ? "Your signup was saved. Request another email link to verify your address."
              : "Check your inbox for the BlindCap verification email. Click the link so an administrator can approve your profile."}
        </p>
        <p>Once verified, you can sign in and check your approval status. Joining and hosting events requires administrator approval.</p>
        <VerificationEmailForm />
        <p><LoadingLink href="/#sign-in">Back to sign in</LoadingLink></p>
      </section>
    </main>
  );
}
