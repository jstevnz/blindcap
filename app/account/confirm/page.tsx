"use client";
import { useEffect, useState, useRef } from "react";
import VerificationEmailForm from "@/app/components/VerificationEmailForm";
import { browser } from "@/lib/browser";
export default function Confirm() {
  const [error, setError] = useState("");
  const [recovery, setRecovery] = useState(false);
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const hash = new URLSearchParams(location.hash.slice(1)),
      token = hash.get("token_hash"),
      type = hash.get("type") === "recovery" ? "recovery" : "email";
    setRecovery(type === "recovery");
    history.replaceState(null, "", "/account/confirm");
    if (!token) {
      setError("Open the full verification link from your email.");
      return;
    }
    browser()
      .auth.verifyOtp({ token_hash: token, type })
      .then(({ error }) => {
        if (error)
          setError(
            "That email link was used or expired.",
          );
        else
          location.replace(type === "recovery" ? "/account?recovery=1" : "/");
      })
      .catch(() => setError("Unable to verify this link. Please try again."));
  }, []);
  return (
    <main className="narrow">
      <p className="eyebrow">PRIVATE COMMUNITY</p>
      <h1>Verifying your email.</h1>
      {error ? (
        <section className="panel">
          <p className="error" role="alert">{error}</p>
          {recovery ? <p>Use Forgot password on the <a href="/#sign-in">sign-in page</a> to request a new reset link.</p> : (
            <>
              <p>Enter the email you signed up with to get a new verification link.</p>
              <VerificationEmailForm />
              <p><a href="/#sign-in">Return to sign in</a></p>
            </>
          )}
        </section>
      ) : (
        <p>Please wait while Blindcap confirms your account…</p>
      )}
    </main>
  );
}
