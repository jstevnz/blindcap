"use client";
import MemberPortal from "./components/MemberPortal";
import LoadingLink from "@/app/components/LoadingLink";
import { PublicTasting, SampleScorecard } from "./components/PublicTasting";
import { useEffect, useState } from "react";
import { browser, configured, request } from "@/lib/browser";
type Self = {
  profile: {
    avatarUrl?: string | null;
    displayName: string;
    status: string;
    role: string;
  } | null;
  guest: boolean;
};
export default function Home() {
  const [user, setUser] = useState(""),
    [self, setSelf] = useState<Self | null>(null),
    [events, setEvents] = useState<
      { id: string; title: string; phase: string; admin: boolean }[]
    >([]),
    [identifier, setIdentifier] = useState(""),
    [password, setPassword] = useState(""),
    [mode, setMode] = useState<"password" | "email-login" | "recover">(
      "password",
    ),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    const { data } = await browser().auth.getUser();
    if (!data.user) return;
    setUser(data.user.email ?? "");
    const account: Self = await request("/api/community", {
      operation: "self",
    });
    setSelf(account);
    if (!account.profile) {
      const list = await request("/api/events");
      setEvents(list);
    }
  }
  useEffect(() => {
    if (configured) load().catch((e) => setError(e.message));
  }, []);
  async function act(f: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await f();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const signOut = () => act(async () => {
    const { error } = await browser().auth.signOut();
    if (error) throw error;
    setUser("");
    setSelf(null);
    setEvents([]);
  });

  if (user && self?.profile?.status === "active") {
    return <MemberPortal profile={self.profile} signingOut={busy} onSignOut={signOut} error={error} />;
  }
  return (
    <main className={user ? undefined : "public-home"}>
      <div className={user ? undefined : "public-hero"}>
      <section className={user ? "dashboard-heading" : "hero"}>
        <h1>
          {user ? (
            <>
              Your Blindcap.
            </>
          ) : (
            <>
              Mystery meets
              <br />
              <em>competition.</em>
            </>
          )}
        </h1>
        <p className="intro">
          <strong>
            {user ? "Bring your group. Keep the mystery." : "One winner."}
          </strong>
        </p>
        {!user && (
          <p className="intro">
            Blindcap brings people together for blind comparisons and friendly
            competition. Build your own event, invite your group, and keep the
            entries anonymous. Everyone scores and ranks their favorites before
            the reveal crowns a winner.
          </p>
        )}
        {!user && <div className="public-hero-actions">
          <LoadingLink className="button" href="/register">Create a profile</LoadingLink>
          <a href="#play-a-round">See how a round works ↓</a>
        </div>}
        {!user && <div className="hero-rule">
          <span>BUILD YOUR EVENT</span>
          <span>COMPARE BLIND</span>
          <span>REVEAL THE WINNER</span>
        </div>}
      </section>
      {!user && <SampleScorecard />}
      </div>
      {!user && <section className="how" id="how-it-works" aria-label="How BlindCap works">
        <div>
          <span>01 / CREATE</span>
          <h3>Build your own event.</h3>
          <p>
            Name your event, invite your group and keep the entries anonymous.
          </p>
        </div>
        <div>
          <span>02 / COMPARE</span>
          <h3>Make your own call.</h3>
          <p>Score and rank each entry before its identity is revealed.</p>
        </div>
        <div>
          <span>03 / REVEAL</span>
          <h3>Celebrate the winner.</h3>
          <p>
            Reveal the results, compare your favorites and revisit your own
            rankings.
          </p>
        </div>
      </section>}
      {!user && <PublicTasting />}
      <section className="panel welcome" id="sign-in">
        <p className="eyebrow">YOUR SEAT AT THE TABLE</p>
        <h2>
          {user ? "Welcome back." : "Your next event starts here."}
        </h2>
        {!configured ? (
          <p>The tasting room is being prepared.</p>
        ) : user ? (
          <>
            <p className="muted">
              {self?.guest
                ? "Signed in to your guest seat"
                : `Signed in as ${user}`}
            </p>
            {self?.profile && (
              <p>
                <LoadingLink href="/account">My profile & password →</LoadingLink>
              </p>
            )}
            {self?.profile?.status === "pending" ? (
              <section className="notice" aria-labelledby="approval-status">
                <h3 id="approval-status">Awaiting administrator approval</h3>
                <p>Your email is verified. You can view and edit your profile while your application is reviewed. Once approved, you can join and host events.</p>
              </section>
            ) : (
              <div className="event-list">
                {events.map((e) => (
                  <LoadingLink className="event-link" key={e.id} href={`/event/${e.id}`}>
                    <span>
                      <strong>{e.title}</strong>
                      <small>
                        {e.admin ? "HOST" : "TASTER"} · {e.phase.toUpperCase()}
                      </small>
                    </span>
                    <span>↗</span>
                  </LoadingLink>
                ))}
                {!events.length && (
                  <p>Your accepted events will appear here.</p>
                )}
              </div>
            )}
            {self?.profile?.status !== "pending" && <p className="fine">Guest invitations continue to work. <LoadingLink href="/register">Create a profile</LoadingLink> to keep your history and host events.</p>}
            <button
              className="text-button"
              onClick={signOut}
            >
              Sign out
            </button>
          </>
        ) : (
          <>
            <p className="muted">
              Sign in to host an event or accept an invitation. New here? Create
              a profile below.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                act(async () => {
                  if (mode === "password") {
                    const d = await request("/api/community", {
                      operation: "login",
                      email: identifier,
                      password,
                    });
                    if (d.verificationRequired) {
                      location.assign("/account/verify-email");
                      return;
                    }
                    const { error } = await browser().auth.setSession(
                      d.session,
                    );
                    if (error) throw error;
                    setPassword("");
                    await load();
                  } else {
                    await request("/api/community", {
                      operation: mode,
                      email: identifier,
                    });
                    setNotice(
                      "If that email has an eligible account, a private link has been sent.",
                    );
                  }
                });
              }}
            >
              <label>
                Email address
                <input
                  autoComplete="email"
                  type="email"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                />
              </label>
              {mode === "password" && (
                <label>
                  Password
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    maxLength={128}
                  />
                </label>
              )}
              <button disabled={busy}>
                {busy
                  ? "Please wait…"
                  : mode === "password"
                    ? "Sign in"
                    : mode === "recover"
                      ? "Email password reset"
                      : "Email sign-in link"}{" "}
                <span>↗</span>
              </button>
            </form>
            <div className="actions">
              {mode !== "password" && (
                <button
                  className="text-button"
                  onClick={() => setMode("password")}
                >
                  Use password
                </button>
              )}
              {mode !== "email-login" && (
                <button
                  className="text-button"
                  onClick={() => setMode("email-login")}
                >
                  Use email sign-in link
                </button>
              )}
              {mode !== "recover" && (
                <button
                  className="text-button"
                  onClick={() => setMode("recover")}
                >
                  Forgot password?
                </button>
              )}
            </div>
            <LoadingLink className="event-link" href="/register">
              <strong>Sign up</strong>
              <span>Create your profile →</span>
            </LoadingLink>
            <p className="fine">
              Administrator approval is required before joining events or
              hosting.
            </p>
          </>
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
      </section>
    </main>
  );
}
