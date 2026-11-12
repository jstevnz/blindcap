"use client";
import BlindcapLoading from "@/app/components/BlindcapLoading";
import { useCallback, useEffect, useRef, useState } from "react";
import CommunityDashboard from "@/app/components/CommunityDashboard";
import { request } from "@/lib/browser";
type Applicant = {
  status: "pending" | "suspended";
  id: string;
  username: string;
  full_name: string;
  display_name: string;
  email: string;
  phone: string;
  location: string;
  bio: string;
  created_at: string;
  verified: boolean;
  admin_notified_at: string | null;
};
export default function Members() {
  const [rows, setRows] = useState<Applicant[] | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [target, setTarget] = useState<Applicant | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const load = useCallback(async () => {
    const d = await request("/api/community", { operation: "pending-members" });
    setRows(d.applications);
  }, []);
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);
  useEffect(() => {
    if (target && !dialog.current?.open) dialog.current?.showModal();
  }, [target]);
  async function review(p: Applicant, decision: "approve" | "delete") {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await request("/api/community", {
        operation: "review-member",
        userId: p.id,
        username: p.username,
        decision,
        confirmed: decision === "delete",
      });
      setTarget(null);
      setNotice(
        decision === "approve"
          ? `${p.display_name} is approved and can now host events and appear in member searches.`
          : `${p.display_name}’s pending signup was deleted.`,
      );
      await load();
    } catch (e) {
      setError((e as Error).message);
      setTarget(null);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="narrow">
      <p className="eyebrow">COMMUNITY OWNER</p>
      <div className="row-between">
        <h1>Signup reviews.</h1>
        <a href="/">← Home</a>
      </div>
      <p><a href="/members/directory">Browse all participants →</a></p>
      <p>
        Review pending profiles. An applicant must verify their email before you
        can approve them. Only approved profiles can host events or appear in
        host searches.
      </p>
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
      {rows && (
        <section className="panel">
          <div className="row-between">
            <h2>Pending signups · {rows.length}</h2>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => {
                setError("");
                load().catch((e) => setError(e.message));
              }}
            >
              Refresh
            </button>
          </div>
          {!rows.length && <p>No signups awaiting review.</p>}
          {rows.map((p) => (
            <article className="managed-event" key={p.id}>
              <h3>{p.full_name || p.display_name}</h3>
              <p>
                {p.display_name}
              </p>
              <p>
                {p.email} ·{" "}
                {p.status === "suspended"
                  ? "Account disabled — deletion pending"
                  : p.verified
                    ? "Email verified"
                    : "Awaiting email verification"}
              </p>
              {p.status === "suspended" && (
                <p className="notice">
                  Signup disabled. Retry deletion to finish removing its sign-in
                  account.
                </p>
              )}
              {p.phone && <p>Phone: {p.phone}</p>}
              {p.location && <p>City/state: {p.location}</p>}
              {p.bio && <p>Tasting notes: {p.bio}</p>}
              <p className="fine">
                Signed up {new Date(p.created_at).toLocaleString()}
              </p>
              <div className="actions">
                <button
                  disabled={busy || !p.verified || p.status !== "pending"}
                  onClick={() => review(p, "approve")}
                >
                  Approve member
                </button>
                <button
                  className="secondary danger-outline"
                  disabled={busy}
                  onClick={() => {
                    setError("");
                    setTarget(p);
                  }}
                >
                  {p.status === "suspended"
                    ? "Retry deletion"
                    : "Delete signup"}
                </button>
              </div>
            </article>
          ))}
        </section>
      )}
      {!rows && !error && <BlindcapLoading label="Loading signup reviews…" />}
      {rows && <CommunityDashboard owner communityOnly />}
      {target && (
        <dialog
          ref={dialog}
          className="panel delete-dialog"
          aria-labelledby="delete-signup-heading"
          onCancel={(e) => {
            e.preventDefault();
            if (!busy) setTarget(null);
          }}
        >
          <h2 id="delete-signup-heading">Delete this pending signup?</h2>
          <p>
            <strong>{target.full_name || target.display_name}</strong>
            <br />
            {target.email}
          </p>
          <p>
            This removes this pending profile and sign-in account. It cannot be
            undone. Existing approved members and events are not deleted.
          </p>
          <div className="actions">
            <button
              autoFocus
              className="secondary"
              disabled={busy}
              onClick={() => setTarget(null)}
            >
              Keep signup
            </button>
            <button
              className="danger"
              disabled={busy}
              onClick={() => review(target, "delete")}
            >
              Delete permanently
            </button>
          </div>
        </dialog>
      )}
    </main>
  );
}
