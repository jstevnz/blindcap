"use client";
import { useCallback, useEffect, useState } from "react";
import type { Snapshot, Command } from "@/lib/engine";
import { request } from "@/lib/browser";
import PhysicalMailingList from "./PhysicalMailingList";
import BottleEntryForm from "./BottleEntryForm";
type Profile = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};
function ParticipantSlot({
  slot,
  e,
  send,
  busy,
  onDirty,
}: {
  slot: number;
  e: Snapshot;
  send: (c: Command) => Promise<void>;
  busy: boolean;
  onDirty: (slot: number, dirty: boolean) => void;
}) {
  const saved = e.participants.find(
    (p, i) => ("slot" in p ? p.slot : i) === slot,
  );
  const [manual, setManual] = useState(
      !!saved && !("accountId" in saved && saved.accountId),
    ),
    [query, setQuery] = useState(""),
    [results, setResults] = useState<
      { id: string; firstName: string; lastName: string; displayName: string }[]
    >([]),
    [profile, setProfile] = useState<Profile | null>(null),
    [first, setFirst] = useState(
      saved && "firstName" in saved ? String(saved.firstName ?? "") : "",
    ),
    [last, setLast] = useState(
      saved && "lastName" in saved ? String(saved.lastName ?? "") : "",
    ),
    [email, setEmail] = useState(
      saved && "email" in saved ? String(saved.email) : "",
    ),
    [error, setError] = useState("");
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    let active = true;
    const timer = setTimeout(
      () =>
        request(`/api/events/${e.id}/enrollment`, {
          operation: "search",
          query,
        })
          .then((d) => {
            if (active) setResults(d.profiles);
          })
          .catch((err) => {
            if (active) setError(err.message);
          }),
      300,
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, e.id]);
  const dirty =
    !!query ||
    !!profile ||
    first !==
      String(saved && "firstName" in saved ? (saved.firstName ?? "") : "") ||
    last !==
      String(saved && "lastName" in saved ? (saved.lastName ?? "") : "") ||
    email !== String(saved && "email" in saved ? saved.email : "");
  useEffect(() => {
    onDirty(slot, dirty);
  }, [slot, dirty, onDirty]);
  const canEdit = e.phase === "setup",
    accountId =
      profile?.id ??
      (saved && "accountId" in saved
        ? String(saved.accountId ?? "")
        : undefined);
  async function choose(id: string) {
    try {
      const d = await request(`/api/events/${e.id}/enrollment`, {
        operation: "profile",
        profileId: id,
      });
      setProfile(d.profile);
      setFirst(d.profile.firstName);
      setLast(d.profile.lastName);
      setEmail(d.profile.email);
      setResults([]);
      setQuery("");
      setError("");
    } catch (err) {
      setError((err as Error).message);
    }
  }
  return (
    <fieldset>
      <legend>
        Participant {slot + 1}
        {dirty ? " · Unsaved changes" : saved ? " · Saved" : ""}
      </legend>
      {canEdit && (
        <>
          <label>
            Search approved profiles
            <input
              value={query}
              maxLength={80}
              placeholder="First name, last name or username"
              onChange={(ev) => {
                setManual(false);
                setQuery(ev.target.value);
              }}
            />
          </label>
          {results.map((p) => (
            <button
              type="button"
              className="secondary search-result"
              key={p.id}
              onClick={() => choose(p.id)}
            >
              {[p.firstName, p.lastName].filter(Boolean).join(" ") ||
                p.displayName}
            </button>
          ))}
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setManual(!manual);
              setProfile(null);
              setFirst("");
              setLast("");
              setEmail("");
            }}
          >
            {manual
              ? "Choose a profile instead"
              : "Enter a participant manually"}
          </button>
        </>
      )}
      {(manual || profile || saved) && (
        <form
          onSubmit={(ev) => {
            ev.preventDefault();
            send({
              type: "roster-seat",
              slot,
              firstName: first,
              lastName: last,
              email,
              ...(!manual && accountId ? { accountId } : {}),
            });
          }}
        >
          <label>
            First name
            <input
              required
              readOnly={!manual || !canEdit}
              maxLength={100}
              value={first}
              onChange={(ev) => setFirst(ev.target.value)}
            />
          </label>
          <label>
            Last name
            <input
              required={manual}
              readOnly={!manual || !canEdit}
              maxLength={100}
              value={last}
              onChange={(ev) => setLast(ev.target.value)}
            />
          </label>
          <label>
            Email
            <input
              type="email"
              required
              readOnly={!manual || !canEdit}
              maxLength={254}
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
            />
          </label>
          {canEdit && <button disabled={busy}>Save participant</button>}
        </form>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}
export default function ParticipantEnrollment({
  e,
  send,
  refresh,
  busy,
}: {
  e: Snapshot & {
    enrollmentProgress?: { confirmed: number; complete: number } | null;
  };
  send: (c: Command) => Promise<void>;
  refresh: () => Promise<void>;
  busy: boolean;
}) {
  const [dirty, setDirty] = useState<Record<number, boolean>>({});
  const onDirty = useCallback(
    (slot: number, value: boolean) =>
      setDirty((previous) =>
        previous[slot] === value ? previous : { ...previous, [slot]: value },
      ),
    [],
  );
  const [emailBusy, setEmailBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [error, setError] = useState("");
  async function invite() {
    setEmailBusy(true);
    setError("");
    try {
      if (!e.rosterInvited) {
        await send({ type: "invite-roster" });
      }
      const r = await request(`/api/events/${e.id}/enrollment`, {
        operation: "send",
      });
      setNotice(
        `${r.sent} invitations accepted for email delivery. ${r.failed} need retrying.`,
      );
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEmailBusy(false);
    }
  }
  const complete = e.bottles.filter(
      (b) => "name" in b && b.name && b.distillery && b.proof,
    ).length,
    confirmed = e.enrollmentProgress?.confirmed ?? 0;
  return (
    <>
      <section className="panel">
        <p className="eyebrow">1 / SELECT PARTICIPANTS</p>
        <h2>Your invited group</h2>
        <p>
          Search first, select the matching profile, then save. Email is filled
          only after selection. Manual participants receive a signup invitation;
          their seat connects after email verification and community approval.
        </p>
        <div className="setup-grid">
          {Array.from({ length: e.tasterCount }, (_, slot) => (
            <ParticipantSlot
              key={`${slot}:${JSON.stringify(e.participants.find((p, i) => ("slot" in p ? p.slot : i) === slot) ?? null)}`}
              onDirty={onDirty}
              slot={slot}
              e={e}
              send={send}
              busy={busy || emailBusy}
            />
          ))}
        </div>
        {e.phase === "setup" && (
          <button
            disabled={
              busy ||
              emailBusy ||
              e.participants.length !== e.tasterCount ||
              Object.values(dirty).some(Boolean)
            }
            onClick={invite}
          >
            {emailBusy
              ? "Sending…"
              : e.rosterInvited
                ? "Retry unsent invitations"
                : "Send email invitations to the group"}
          </button>
        )}
        {notice && <p role="status">{notice}</p>}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </section>
      {e.participants.length === e.tasterCount && !Object.values(dirty).some(Boolean) && <PhysicalMailingList id={e.id} />}
      {e.rosterInvited && (
        <section className="panel">
          <p className="eyebrow">2 / CONFIRM BOTTLES</p>
          <h2>Participant bottle details</h2>
          <p>
            {confirmed}/{e.tasterCount} participants confirmed · {complete}/
            {e.tasterCount} bottles complete. Participants enter their own
            details. You can fill blanks or make corrections before tasting
            starts.
          </p>
          {e.participants.map((p) => {
            const b = e.bottles.find(
              (b) => "ownerId" in b && b.ownerId === p.id,
            );
            return (
              <details key={p.id} className="invite-row">
                <summary>
                  {p.name} · {b && "name" in b ? b.name : "Bottle not entered"}
                </summary>
                {e.phase === "setup" ||
                e.groups.every((g) => g.status === "waiting") ? (
                  <BottleEntryForm
                    key={b && "name" in b ? `${b.name}:${b.proof}` : p.id}
                    initial={
                      b && "name" in b
                        ? {
                            name: b.name,
                            distillery: b.distillery ?? "",
                            proof: b.proof ?? "",
                          }
                        : null
                    }
                    busy={busy}
                    label="Save bottle details"
                    onSave={async (values) => {
                      await send({
                        type: "bottle-entry",
                        participantId: p.id,
                        ...values,
                      });
                    }}
                  />
                ) : (
                  <p>Details are locked because tasting has begun.</p>
                )}
              </details>
            );
          })}
          {e.phase === "setup" && (
            <button
              disabled={
                busy ||
                complete !== e.tasterCount ||
                confirmed !== e.tasterCount
              }
              onClick={() => {
                if (
                  window.confirm(
                    "Lock the participant list and prepare the random blind draw? You will review the private pour sheet before opening the first flight.",
                  )
                )
                  send({ type: "start" });
              }}
            >
              Prepare event & draw flights
            </button>
          )}
        </section>
      )}
    </>
  );
}
