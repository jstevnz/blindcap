"use client";
import { useEffect, useState } from "react";
import { request, browser } from "@/lib/browser";
export default function Register() {
  const [token, setToken] = useState(""),
    [email, setEmail] = useState(""),
    [username, setUsername] = useState(""),
    [name, setName] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(location.hash.slice(1));
    const t =
      params.get("invite") ??
      sessionStorage.getItem("blindcap-community-invite") ??
      "";
    history.replaceState(null, "", "/register");
    setToken(t);
    if (!t) return;
    sessionStorage.setItem("blindcap-community-invite", t);
    request("/api/community", { operation: "invitation", token: t })
      .then((d) => setEmail(d.email))
      .catch((e) => setError(e.message));
    browser()
      .auth.getUser()
      .then(({ data }) =>
        setSignedIn(
          !!data.user?.email_confirmed_at &&
            !data.user.email?.endsWith("@guests.blindcap.invalid"),
        ),
      );
  }, []);
  async function join() {
    setBusy(true);
    setError("");
    try {
      const response = await request("/api/community", {
        operation: signedIn ? "enroll" : "register",
        token,
        username,
        displayName: name,
        password,
      });
      if (signedIn) {
        sessionStorage.removeItem("blindcap-community-invite");
        location.replace("/");
      } else {
        setPassword("");
        setNotice(
          response.existingRegistration
            ? "Verification resent. Your original username and password are unchanged. After verifying, use Forgot password if you need to reset it."
            : "Check your email and open the verification link to finish joining. Any guest history connected during registration will follow your account.",
        );
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="narrow">
      <p className="eyebrow">INVITATION ONLY</p>
      <h1>Your place in the community.</h1>
      <section className="panel">
        <h2>Join Blindcap</h2>
        {!token ? (
          <p>
            Registration is private. Ask the community owner for an invitation.
          </p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              join();
            }}
          >
            <label>
              Invited email
              <input value={email} readOnly type="email" />
            </label>
            <label>
              Username
              <input
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                pattern="[a-zA-Z][a-zA-Z0-9_]{2,23}"
                minLength={3}
                maxLength={24}
                required
              />
              <small>
                3–24 letters, numbers or underscores; start with a letter.
              </small>
            </label>
            <label>
              Display name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                required
              />
            </label>
            {!signedIn && (
              <label>
                Password
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={128}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <small>At least 12 characters.</small>
              </label>
            )}
            <button disabled={busy || !email}>
              {busy
                ? "Please wait…"
                : signedIn
                  ? "Join the community"
                  : "Create my account"}
            </button>
            <p className="fine">
              Every member can host events or join another host’s event. Your
              tasting history stays private. Already have an account?{" "}
              <a href="/">Sign in first</a>, then reopen this invitation.
            </p>
          </form>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="notice">
            {notice}
          </p>
        )}
      </section>
    </main>
  );
}
