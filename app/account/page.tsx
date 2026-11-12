"use client";
import { useEffect, useState } from "react";
import TastingHistory from "@/app/components/TastingHistory";
import ProfilePhoto from "@/app/components/ProfilePhoto";
import ProfileAchievements from "@/app/components/ProfileAchievements";
import { request, browser } from "@/lib/browser";
import MailingAddressFields, {
  type MailingAddress,
} from "@/app/components/MailingAddress";
export default function Account() {
  const [p, setProfile] = useState<{
      avatarUrl?: string | null;
      status: string;
      fullName: string;
      firstName: string;
      lastName: string;
      phone: string;
      location: string;
      mailingAddress: MailingAddress;
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
        if (["active", "pending"].includes(d.profile?.status))
          setProfile(d.profile);
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
      <div className="row-between"><h1>My Profile and Password.</h1><a href="/">← Home</a></div>
      <nav className="actions section-navigation" aria-label="Profile sections"><a href="#profile-details">My details</a><a href="#password">Password</a><a href="#tasting-history">My Events & awards</a></nav>
      {p && (
        <>
          {p.status === "pending" && (
            <p className="notice">
              Your profile is pending administrator approval. Profile changes do
              not grant event access.
            </p>
          )}
          <ProfilePhoto name={p.displayName} initialUrl={p.avatarUrl} />
          <section className="panel" id="profile-details">
            <h2>My profile</h2>
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
                First name
                <input
                  autoComplete="given-name"
                  value={p.firstName ?? ""}
                  maxLength={100}
                  onChange={(e) =>
                    setProfile({ ...p, firstName: e.target.value })
                  }
                />
              </label>
              <label>
                Last name
                <input
                  autoComplete="family-name"
                  value={p.lastName ?? ""}
                  maxLength={100}
                  onChange={(e) =>
                    setProfile({ ...p, lastName: e.target.value })
                  }
                />
              </label>
              <label>
                Phone (optional)
                <input
                  type="tel"
                  autoComplete="tel"
                  value={p.phone}
                  onChange={(e) => setProfile({ ...p, phone: e.target.value })}
                  maxLength={30}
                />
              </label>
              <MailingAddressFields
                value={p.mailingAddress ?? {}}
                onChange={(mailingAddress) =>
                  setProfile({ ...p, mailingAddress })
                }
              />
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
          <section className="panel" id="password">
            <h2>Set or change your password</h2>
            <p>
              Your existing email-link login continues to work. Adding a
              password lets you sign in with your email.
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
          {p.status === "active" && <><TastingHistory /><ProfileAchievements /></>}
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
