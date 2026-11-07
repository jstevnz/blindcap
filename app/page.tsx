"use client";
import { useEffect, useState } from "react";
import { browser, configured, request } from "@/lib/browser";
export default function Home() {
  const [email, setEmail] = useState(""),
    [code, setCode] = useState(""),
    [sent, setSent] = useState(false),
    [user, setUser] = useState(""),
    [events, setEvents] = useState<
      { id: string; title: string; phase: string; admin: boolean }[]
    >([]),
    [title, setTitle] = useState("Yorktown Bourbon Night"),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    const s = browser();
    const { data } = await s.auth.getUser();
    if (data.user) {
      setUser(data.user.email ?? "");
      setEvents(await request("/api/events"));
    }
  }
  useEffect(() => {
    if (new URLSearchParams(location.search).get("auth") === "expired")
      setError("That sign-in link expired. Please request another.");
    if (configured) load().catch((e) => setError(e.message));
  }, []);
  async function act(f: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await f();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main>
      <section className="hero">
        <p className="eyebrow">THE YORKTOWN TRADITION</p>
        <h1>
          Twelve bottles.
          <br />
          One <em>Tumbler.</em>
        </h1>
        <p className="intro">
          Leave the labels behind.
          <br />
          Let your palate pick the winner.
        </p>
        <div className="hero-rule">
          <span>12 TASTERS</span>
          <span>3 STAGES</span>
          <span>100% BLIND</span>
        </div>
      </section>
      <section className="panel welcome">
        <p className="eyebrow">YOUR SEAT AT THE TABLE</p>
        <h2>{user ? "Welcome back." : "The night starts here."}</h2>
        {!configured ? (
          <>
            <p>
              The tasting room is being prepared. Your host still needs to
              connect the database before sign-in opens.
            </p>
            <a className="button secondary" href="/rules">
              See how the tasting works
            </a>
          </>
        ) : user ? (
          <>
            <p className="muted">
              {user.endsWith("@guests.blindcap.invalid")
                ? "Signed in to your guest seat"
                : `Signed in as ${user}`}
            </p>
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
                <p>
                  No invitations yet. Open the private invitation link your host
                  sent you.
                </p>
              )}
            </div>
            {!user.endsWith("@guests.blindcap.invalid") && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  act(async () => {
                    const event = await request("/api/events", { title });
                    location.href = `/event/${event.id}`;
                  });
                }}
              >
                <label>
                  Hosting a night?
                  <input
                    value={title}
                    maxLength={100}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </label>
                <button disabled={busy}>
                  Create an event <span>↗</span>
                </button>
              </form>
            )}
            <button
              className="text-button"
              onClick={() =>
                act(async () => {
                  await browser().auth.signOut();
                  setUser("");
                  setEvents([]);
                })
              }
            >
              Sign out
            </button>
          </>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              act(async () => {
                const s = browser();
                if (sent) {
                  const { error } = await s.auth.verifyOtp({
                    email,
                    token: code,
                    type: "email",
                  });
                  if (error) throw error;
                  await load();
                } else {
                  const { error } = await s.auth.signInWithOtp({
                    email,
                    options: {
                      shouldCreateUser: true,
                      emailRedirectTo: location.origin + "/auth/callback",
                    },
                  });
                  if (error) throw error;
                  setSent(true);
                  setMessage(
                    "Check your email. Open the sign-in link on this device, or enter the code if your email includes one.",
                  );
                }
              });
            }}
          >
            <label>
              Your email
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={sent}
                placeholder="you@example.com"
                required
              />
            </label>
            {sent && (
              <label>
                Sign-in code
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                />
              </label>
            )}
            <button disabled={busy}>
              {busy
                ? "Please wait…"
                : sent
                  ? "Take your seat"
                  : "Email me a sign-in link"}
              <span>↗</span>
            </button>
            {sent && (
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setSent(false);
                  setMessage("");
                }}
              >
                Use another email or request a new code
              </button>
            )}
            <p className="fine">
              Hosting? Sign in with your Supabase account email. Guests use
              their private invitation link.
            </p>
          </form>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {message && <p role="status">{message}</p>}
      </section>
      <section className="how">
        <div>
          <span>01 / THE DRAW</span>
          <h3>Meet your mystery pours.</h3>
          <p>Four opening flights. Three anonymous bottles in each.</p>
        </div>
        <div>
          <span>02 / THE TASTE</span>
          <h3>Trust your own palate.</h3>
          <p>
            Score each pour, then rank your favorites. Preference leads the way.
          </p>
        </div>
        <div>
          <span>03 / THE REVEAL</span>
          <h3>A toast to the champion.</h3>
          <p>The Yorktown Tumbler awaits. So does the infamous Swill Award.</p>
        </div>
      </section>
      <a className="text-button" href="/rules">
        Read the scoring rules →
      </a>
    </main>
  );
}
