"use client";
import { useEffect, useState } from "react";
import { browser, configured, request } from "@/lib/browser";
import { tournamentPlan } from "@/lib/tournament";
import CommunityDashboard from "./components/CommunityDashboard";
type Self = {
  profile: {
    username: string;
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
    [title, setTitle] = useState(""),
    [count, setCount] = useState(12),
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
  const member = self?.profile?.status === "active";
  const plan = tournamentPlan(count);
  return (
    <main>
      <section className="hero">
        <h1>
          {user ? (
            <>
              Your next
              <br />
              <em>event.</em>
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
        <div className="hero-rule">
          <span>BUILD YOUR EVENT</span>
          <span>COMPARE BLIND</span>
          <span>REVEAL THE WINNER</span>
        </div>
      </section>
      <section className="panel welcome">
        <p className="eyebrow">YOUR SEAT AT THE TABLE</p>
        <h2>
          {member
            ? `Welcome, ${self.profile!.displayName}.`
            : user
              ? "Welcome back."
              : "Your next event starts here."}
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
                <a href="/account">My profile & password →</a>
              </p>
            )}
            {member ? (
              <div className="actions home-navigation">
                <a className="event-link" href="/series">
                  <strong>Event series</strong>
                  <span>Annual history & leaderboards →</span>
                </a>
                <a className="event-link" href="/events">
                  <strong>Events</strong>
                  <span>View & manage →</span>
                </a>
                {self.profile?.role === "owner" && (
                  <a className="event-link" href="/members">
                    <strong>Signup reviews</strong>
                    <span>Approve pending profiles →</span>
                  </a>
                )}
              </div>
            ) : self?.profile?.status === "pending" ? (
              <p className="notice">
                Your profile is pending administrator approval. You can edit
                your profile while waiting. Hosting and event invitations become
                available after approval.
              </p>
            ) : (
              <div className="event-list">
                {events.map((e) => (
                  <a className="event-link" key={e.id} href={`/event/${e.id}`}>
                    <span>
                      <strong>{e.title}</strong>
                      <small>
                        {e.admin ? "HOST" : "TASTER"} · {e.phase.toUpperCase()}
                      </small>
                    </span>
                    <span>↗</span>
                  </a>
                ))}
                {!events.length && (
                  <p>Your accepted events will appear here.</p>
                )}
              </div>
            )}
            {member ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  act(async () => {
                    const event = await request("/api/events", {
                      title,
                      tasterCount: count,
                    });
                    location.href = `/event/${event.id}`;
                  });
                }}
              >
                <label>
                  Name a new one-time event
                  <input
                    value={title}
                    placeholder="Enter an event name"
                    maxLength={100}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </label>
                <label>
                  Number of tasters / bottles
                  <select
                    value={count}
                    onChange={(e) => setCount(Number(e.target.value))}
                  >
                    {Array.from({ length: 15 }, (_, i) => (
                      <option value={i + 2} key={i + 2}>
                        {i + 2} tasters · {i + 2} bottles
                      </option>
                    ))}
                  </select>
                </label>
                <p className="fine">
                  {count <= 4
                    ? `One final of ${count}${count === 2 ? " · Head-to-head" : ""}`
                    : `Opening: ${plan.opening.join(" + ")}${plan.semifinal.length ? ` → Semifinals: ${plan.semifinal.join(" + ")}` : ""} → Final four`}
                </p>
                <button disabled={busy}>
                  Create an event <span>↗</span>
                </button>
              </form>
            ) : self?.profile?.status === "pending" ? null : (
              <p className="fine">
                Guest invitations continue to work. To keep permanent history
                and host your own events,{" "}
                <a href="/register">sign up for a profile</a>. Stay signed into
                this guest seat during signup to connect this history after
                approval.
              </p>
            )}
            <button
              className="text-button"
              onClick={() =>
                act(async () => {
                  await browser().auth.signOut();
                  setUser("");
                  setSelf(null);
                  setEvents([]);
                })
              }
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
                      identifier,
                      password,
                    });
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
                {mode === "password" ? "Username or email" : "Email address"}
                <input
                  autoComplete={mode === "password" ? "username" : "email"}
                  type={mode === "password" ? "text" : "email"}
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
            <a className="event-link" href="/register">
              <strong>Sign up</strong>
              <span>Create your profile →</span>
            </a>
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
      {member && <CommunityDashboard owner={self.profile!.role === "owner"} />}
      <section className="how">
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
      </section>
      <a className="text-button" href="/rules">
        Read the scoring rules →
      </a>
    </main>
  );
}
