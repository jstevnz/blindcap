"use client";
import { useEffect, useState } from "react";
import { request, browser } from "@/lib/browser";
export default function Account() {
  const [p, setProfile] = useState<{
      username: string;
      displayName: string;
      bio: string;
      discoverable: boolean;
      email: string;
    } | null>(null),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    request("/api/community", { operation: "self" })
      .then((d) => {
        if (d.profile?.status === "active") setProfile(d.profile);
        else
          setError(
            "Join the private community before maintaining a member profile.",
          );
      })
      .catch((e) => setError(e.message));
  }, []);
  async function save(f: () => Promise<void>) {
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
  return (
    <main className="narrow">
      <p className="eyebrow">YOUR BLINDCAP ACCOUNT</p>
      <h1>Your profile.</h1>
      {p && (
        <>
          <section className="panel">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                save(async () => {
                  await request("/api/community", {
                    operation: "profile",
                    ...p,
                  });
                  setNotice("Profile saved.");
                });
              }}
            >
              <label>
                Email
                <input value={p.email} readOnly />
              </label>
              <label>
                Username
                <input
                  value={p.username}
                  onChange={(e) =>
                    setProfile({ ...p, username: e.target.value })
                  }
                  minLength={3}
                  maxLength={24}
                  required
                />
              </label>
              <label>
                Display name
                <input
                  value={p.displayName}
                  onChange={(e) =>
                    setProfile({ ...p, displayName: e.target.value })
                  }
                  maxLength={80}
                  required
                />
              </label>
              <label>
                About your tastes
                <textarea
                  value={p.bio}
                  onChange={(e) => setProfile({ ...p, bio: e.target.value })}
                  maxLength={500}
                />
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={p.discoverable}
                  onChange={(e) =>
                    setProfile({ ...p, discoverable: e.target.checked })
                  }
                />
                Show my profile in private community searches
              </label>
              <button disabled={busy}>Save profile</button>
            </form>
          </section>
          <section className="panel">
            <h2>Set or change your password</h2>
            <p>
              Your existing email-link login continues to work. Adding a
              password lets you sign in with your username or email.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                save(async () => {
                  const { error } = await browser().auth.updateUser({
                    password,
                  });
                  if (error) throw error;
                  setPassword("");
                  setNotice("Password saved.");
                });
              }}
            >
              <label>
                New password
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={128}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </label>
              <button disabled={busy}>Save password</button>
            </form>
          </section>
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
      <a href="/">← Dashboard</a>
    </main>
  );
}
