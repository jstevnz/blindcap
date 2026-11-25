"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Avatar from "@/app/components/Avatar";
import BlindcapLoading from "@/app/components/BlindcapLoading";
import LoadingLink from "@/app/components/LoadingLink";
import MailingAddressFields, { type MailingAddress } from "@/app/components/MailingAddress";
import { request } from "@/lib/browser";

type ParticipantProfile = {
  id: string;
  avatarUrl: string | null;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  phone: string;
  location: string;
  mailingAddress: MailingAddress;
  bio: string;
  discoverable: boolean;
  status: "active" | "pending" | "suspended";
};
type ProfileResponse = { profile: ParticipantProfile; version: string };

export default function ParticipantProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [record, setRecord] = useState<ProfileResponse | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setRecord(null);
    setError("");
    setNotice("");
    request("/api/community", { operation: "participant-profile", userId: id })
      .then((data: ProfileResponse) => { if (active) setRecord(data); })
      .catch((error: Error) => { if (active) setError(error.message); });
    return () => { active = false; };
  }, [id, reload]);

  function change<K extends keyof ParticipantProfile>(key: K, value: ParticipantProfile[K]) {
    setRecord((current) => current && ({ ...current, profile: { ...current.profile, [key]: value } }));
    setNotice("");
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!record || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const saved: ProfileResponse = await request("/api/community", {
        ...record.profile,
        operation: "participant-profile-update",
        userId: id,
        version: record.version,
      });
      setRecord(saved);
      setNotice("Participant profile saved.");
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const profile = record?.profile;
  return (
    <main className="narrow">
      <LoadingLink href="/members/directory">← Participant directory</LoadingLink>
      <h1>Participant profile</h1>
      {!profile && !error && <BlindcapLoading label="Loading profile…" />}
      {profile && (
        <section className="panel">
          <div className="row-between">
            <Avatar name={[profile.firstName, profile.lastName].filter(Boolean).join(" ") || profile.displayName} url={profile.avatarUrl} />
            <p>{({ active: "Approved", pending: "Pending approval", suspended: "Disabled" })[profile.status]}</p>
          </div>
          <form onSubmit={save}>
            <fieldset disabled={busy}>
              <label>Email
                <input type="email" value={profile.email} readOnly />
              </label>
              <p className="fine">Email is used for sign-in and invitations. This editor preserves the account email and its connections to events and awards.</p>
              <label>First name
                <input value={profile.firstName} maxLength={100} onChange={(event) => change("firstName", event.target.value)} />
              </label>
              <label>Last name
                <input value={profile.lastName} maxLength={100} onChange={(event) => change("lastName", event.target.value)} />
              </label>
              <label>Display name
                <input value={profile.displayName} required maxLength={80} onChange={(event) => change("displayName", event.target.value)} />
              </label>
              <label>Phone (optional)
                <input type="tel" value={profile.phone} maxLength={30} onChange={(event) => change("phone", event.target.value)} />
              </label>
              <label>City / state (optional)
                <input value={profile.location} maxLength={120} onChange={(event) => change("location", event.target.value)} />
              </label>
              <MailingAddressFields value={profile.mailingAddress} onChange={(value) => change("mailingAddress", value)} />
              <label>About their tastes
                <textarea value={profile.bio} maxLength={500} onChange={(event) => change("bio", event.target.value)} />
              </label>
              <label className="checkbox-label">
                <input type="checkbox" checked={profile.discoverable} onChange={(event) => change("discoverable", event.target.checked)} />
                Show this profile in private community searches
              </label>
              <div className="actions">
                <button type="submit">{busy ? "Saving…" : "Save profile"}</button>
                <button type="button" className="text-button" onClick={() => {
                  if (window.confirm("Reload this profile and discard unsaved edits?")) setReload((value) => value + 1);
                }}>Reload profile</button>
              </div>
            </fieldset>
          </form>
          {profile.status === "pending" && <LoadingLink href={`/members?review=${id}#review-${id}`}>Review this signup →</LoadingLink>}
        </section>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      {notice && <p className="notice" role="status">{notice}</p>}
      {!profile && error && <button type="button" onClick={() => setReload((value) => value + 1)}>Try again</button>}
    </main>
  );
}
