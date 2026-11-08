"use client";
import { useEffect, useState, useRef } from "react";
import { browser } from "@/lib/browser";
export default function Confirm() {
  const [error, setError] = useState("");
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const hash = new URLSearchParams(location.hash.slice(1)),
      token = hash.get("token_hash"),
      type = hash.get("type") === "recovery" ? "recovery" : "email";
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
            "That email link was used or expired. Request a new sign-in or recovery email.",
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
        <p className="error" role="alert">
          {error} <a href="/">Return to sign in</a>
        </p>
      ) : (
        <p>Please wait while Blindcap confirms your account…</p>
      )}
    </main>
  );
}
