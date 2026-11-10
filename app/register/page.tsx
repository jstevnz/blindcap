"use client";
import { useEffect, useState } from "react";
import { request, browser } from "@/lib/browser";
import MailingAddressFields, {
  type MailingAddress,
} from "@/app/components/MailingAddress";
export default function Register() {
  const [token, setToken] = useState(""),
    [email, setEmail] = useState(""),
    [username, setUsername] = useState(""),
    [firstName, setFirstName] = useState(""),
    [lastName, setLastName] = useState(""),
    [name, setName] = useState(""),
    [phone, setPhone] = useState(""),
    [locationText, setLocation] = useState(""),
    [mailingAddress, setMailingAddress] = useState<MailingAddress>({}),
    [bio, setBio] = useState(""),
    [password, setPassword] = useState(""),
    [website, setWebsite] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [signedIn, setSignedIn] = useState(false),
    [submitted, setSubmitted] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(location.hash.slice(1)),
      t = params.get("invite") ?? "";
    history.replaceState(null, "", "/register");
    setToken(t);
    if (t) {
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
    }
  }, []);
  async function join() {
    setBusy(true);
    setError("");
    try {
      const response = await request("/api/community", {
        operation: token ? (signedIn ? "enroll" : "register") : "apply",
        token,
        email,
        username,
        displayName: name,
        firstName,
        lastName,
        phone,
        location: locationText,
        mailingAddress,
        bio,
        password,
        website,
      });
      setPassword("");
      setSubmitted(true);
      if (token && signedIn) location.replace("/");
      else
        setNotice(
          response.verificationSent === false
            ? "Your signup was saved. We could not send the verification email yet. Use the email sign-in link on Home to request another. Approval also requires email verification."
            : response.existingRegistration
              ? "If you already registered, your original username and password are unchanged. Check your email or use Sign in."
              : "Check your email to verify your address. Your profile stays pending until the administrator approves it. You can sign in and edit your profile while waiting.",
        );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="narrow">
      <p className="eyebrow">MEMBERSHIP BY APPROVAL</p>
      <h1>Your place in the community.</h1>
      <section className="panel">
        <h2>Sign up for Blindcap</h2>
        <p>
          Create your profile, verify your email, then wait for administrator
          approval. Approved members can host events and be found by hosts for
          future invitations.
        </p>
        <p className="fine">
          Profile photos are optional. You can add one in your profile after
          confirming your email.
        </p>
        {!submitted && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              join();
            }}
          >
            <label>
              {token ? "Invited email" : "Email address"}
              <input
                type="email"
                autoComplete="email"
                maxLength={254}
                value={email}
                readOnly={!!token}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <label>
              First name
              <input
                required
                autoComplete="given-name"
                value={firstName}
                maxLength={100}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </label>
            <label>
              Last name
              <input
                required
                autoComplete="family-name"
                value={lastName}
                maxLength={100}
                onChange={(e) => setLastName(e.target.value)}
              />
            </label>
            <label>
              Display name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                required
              />
              <small>The name other members see.</small>
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
            </label>
            {!signedIn && (
              <label>
                Password
                <input
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={12}
                  maxLength={128}
                  required
                />
                <small>12–128 characters.</small>
              </label>
            )}
            <label>
              Phone (optional)
              <input
                type="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={30}
              />
            </label>
            <MailingAddressFields
              value={mailingAddress}
              onChange={setMailingAddress}
            />
            <label>
              About your tastes (optional)
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={500}
              />
            </label>
            <div className="signup-trap" aria-hidden="true">
              <label>
                Website
                <input
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </label>
            </div>
            <p className="fine">
              Your full name, phone and city/state are private to you and the
              reviewing administrator. Your email is used for sign-in and event
              invitations and may be seen by your event host. Member searches
              show only your username, display name and tasting notes after
              approval.
            </p>
            <button disabled={busy || !email}>
              {busy ? "Saving your signup…" : "Submit signup"}
            </button>
          </form>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="notice" role="status">
            {notice}
          </p>
        )}
        <p>
          <a href="/">Already registered? Sign in →</a>
        </p>
      </section>
    </main>
  );
}
