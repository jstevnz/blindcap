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
    [title, setTitle] = useState("Yorktown Bourbon Night"),
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
    const list = await request("/api/events");
    setEvents(list);
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
        <p className="eyebrow">THE PRIVATE BLINDCAP COMMUNITY</p>
        <h1>
          Your bottles.
          <br />
          One <em>Tumbler.</em>
        </h1>
        <p className="intro">
          Leave the labels behind.
          <br />
          Let your palate pick the winner.
        </p>
        <div className="hero-rule">
          <span>2–16 TASTERS</span>
          <span>HOST OR PARTICIPATE</span>
          <span>100% BLIND</span>
        </div>
      </section>
      <section className="panel welcome">
        <p className="eyebrow">YOUR SEAT AT THE TABLE</p>
        <h2>
          {member
            ? `Welcome, ${self.profile!.displayName}.`
            : user
              ? "Welcome back."
              : "The night starts here."}
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
            {member && (
              <p>
                <a href="/account">My profile & password →</a>
              </p>
            )}
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
              {!events.length && <p>Your accepted events will appear here.</p>}
            </div>
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
                  Host a new event
                  <input
                    value={title}
                    maxLength={100}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </label>
                <label>
                  Number of tasters
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
            ) : (
              <p className="fine">
                Guest invitations continue to work. To keep permanent history
                and host your own events, ask the community owner for a
                membership invitation. Open it while signed into this guest seat
                to connect this history.
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
              Private community. Sign in to host an event or accept an
              invitation.
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
            <p className="fine">
              New here? Open the private community invitation sent to your
              email. There is no public registration.
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
          <span>01 / HOST</span>
          <h3>Your night, your rules.</h3>
          <p>
            Every member can create a private event and invite other members.
          </p>
        </div>
        <div>
          <span>02 / TASTE</span>
          <h3>Trust your own palate.</h3>
          <p>
            Score each pour and rank your favorites. Preference leads the way.
          </p>
        </div>
        <div>
          <span>03 / REMEMBER</span>
          <h3>Keep your tasting story.</h3>
          <p>
            Your own ballots, bottles and results stay in your private history.
          </p>
        </div>
      </section>
      <a className="text-button" href="/rules">
        Read the scoring rules →
      </a>
    </main>
  );
}
