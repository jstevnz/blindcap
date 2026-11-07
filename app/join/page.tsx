"use client";
import { useEffect, useState } from "react";
import { browser, request } from "@/lib/browser";
export default function Join() {
  const [token, setToken] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    const hash = new URLSearchParams(location.hash.slice(1));
    setToken(hash.get("invite") ?? "");
    history.replaceState(null, "", "/join");
  }, []);
  async function join() {
    setBusy(true);
    setError("");
    try {
      const data = await request("/api/guest", { token });
      const { error } = await browser().auth.verifyOtp({
        token_hash: data.tokenHash,
        type: "email",
      });
      if (error) throw error;
      setToken("");
      location.replace(`/event/${data.eventId}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <main className="narrow">
      <p className="eyebrow">YOUR PRIVATE INVITATION</p>
      <h1>A seat with your name on it.</h1>
      <section className="panel">
        <h2>Welcome to Blindcap.</h2>
        <p>
          Your host invited you to a blind tasting. This link signs you into
          your assigned seat on this device. Keep it private.
        </p>
        <button disabled={!token || busy} onClick={join}>
          {busy ? "Taking your seat…" : "Join the tasting"} <span>↗</span>
        </button>
        {!token && !busy && (
          <p className="muted">
            Open your host’s complete invitation link. If you’ve used it
            already, return to the event on the same device or ask your host for
            a replacement.
          </p>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </section>
    </main>
  );
}
