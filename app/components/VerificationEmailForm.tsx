"use client";

import { useState } from "react";
import { request } from "@/lib/browser";

export default function VerificationEmailForm() {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  return (
    <form onSubmit={async (event) => {
      event.preventDefault();
      if (busy) return;
      const email = new FormData(event.currentTarget).get("email");
      setBusy(true);
      setNotice("");
      setError("");
      try {
        await request("/api/community", { operation: "email-login", email });
        setNotice("If this email has an eligible account, a private verification and sign-in link has been sent.");
      } catch (error) {
        setError((error as Error).message);
      } finally {
        setBusy(false);
      }
    }}>
      <label>Email address
        <input name="email" type="email" autoComplete="email" maxLength={254} required />
      </label>
      <button type="submit" disabled={busy}>{busy ? "Requesting…" : "Request another email link"}</button>
      {notice && <p role="status">{notice}</p>}
      {error && <p className="error" role="alert">{error}</p>}
    </form>
  );
}
