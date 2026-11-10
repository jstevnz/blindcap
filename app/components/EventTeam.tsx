"use client";
import { useEffect, useState } from "react";
import { request } from "@/lib/browser";
import MemberPicker from "./MemberPicker";
import type { MailingAddress } from "./MailingAddress";
type Team = {
  revision: number;
  canManage: boolean;
  primaryHostId: string;
  admins: { id: string; name: string; status: string; primary: boolean }[];
};
type Recipient = {
  participantId: string;
  name: string;
  fullName: string;
  confirmed: boolean;
  address: MailingAddress | null;
};
export function mailingCsv(rows: Recipient[]) {
  const cell = (v: unknown) => {
    let text = String(v ?? "");
    if (/^[=+@\-\t\r\n]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  return [
    [
      "Name",
      "Street address",
      "Apartment / suite",
      "City",
      "State / province",
      "ZIP / postal code",
      "Country",
    ],
    ...rows
      .filter((r) => r.confirmed)
      .map((r) => [
        r.fullName,
        r.address?.line1,
        r.address?.line2,
        r.address?.city,
        r.address?.region,
        r.address?.postalCode,
        r.address?.country,
      ]),
  ]
    .map((row) => row.map(cell).join(","))
    .join("\r\n");
}
export default function EventTeam({
  id,
  onChanged,
}: {
  id: string;
  onChanged: () => Promise<void>;
}) {
  const [team, setTeam] = useState<Team | null>(null),
    [recipients, setRecipients] = useState<Recipient[] | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  async function load() {
    setTeam(await request(`/api/events/${id}/team`));
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [id]);
  async function run(f: () => Promise<void>) {
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
  async function update(ids: string[]) {
    await request(`/api/events/${id}/team`, {
      revision: team!.revision,
      adminIds: ids,
    });
    await load();
    await onChanged();
    setNotice("Event admins updated.");
  }
  return (
    <>
      <section className="panel">
        <h2>Event admins</h2>
        <button
          type="button"
          className="text-button"
          disabled={busy}
          onClick={() => run(load)}
        >
          Refresh admin team
        </button>
        <p>
          Co-admins can manage setup, invitations, scoring and reveal, and
          request confirmed participants’ mailing addresses. Only the primary
          host or site owner can change this team. Event deletion remains with
          the primary host or site owner.
        </p>
        {team?.admins.map((p) => (
          <div className="row-between" key={p.id}>
            <p>
              <strong>{p.name}</strong> ·{" "}
              {p.primary ? "Primary host" : "Co-admin"}
              {p.status !== "active" ? " · Inactive" : ""}
            </p>
            {team.canManage && !p.primary && (
              <button
                className="text-button"
                disabled={busy}
                onClick={() => {
                  if (window.confirm(`Remove ${p.name} as an event admin?`))
                    run(() =>
                      update(
                        team.admins
                          .filter((x) => !x.primary && x.id !== p.id)
                          .map((x) => x.id),
                      ),
                    );
                }}
              >
                Remove co-admin
              </button>
            )}
          </div>
        ))}
        {team?.canManage && team.admins.length < 9 && (
          <MemberPicker
            onClear={() => {}}
            onSelect={(p) => {
              if (team.admins.some((x) => x.id === p.id)) {
                setError("This member is already an event admin.");
                return;
              }
              if (
                window.confirm(
                  `Give ${p.displayName} full admin controls for this event, including access to confirmed participants’ mailing addresses?`,
                )
              )
                run(() =>
                  update([
                    ...team.admins.filter((x) => !x.primary).map((x) => x.id),
                    p.id,
                  ]),
                );
            }}
          />
        )}
      </section>
      <section className="panel">
        <h2>Physical mailing list</h2>
        <p>
          Load addresses from profiles of confirmed participants. Pending
          invitations and guest profiles without a saved address are marked
          below. Addresses are private to the event’s admins.
        </p>
        <button
          className="secondary"
          disabled={busy}
          onClick={() =>
            run(async () => {
              const data = await request(`/api/events/${id}/mailing`, {});
              setRecipients(data.participants);
            })
          }
        >
          {recipients ? "Refresh mailing addresses" : "Load mailing addresses"}
        </button>
        {recipients && (
          <>
            <button className="text-button" onClick={() => setRecipients(null)}>
              Hide addresses
            </button>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Participant</th>
                    <th>Status</th>
                    <th>Mailing address</th>
                  </tr>
                </thead>
                <tbody>
                  {recipients.map((r) => (
                    <tr key={r.participantId}>
                      <td>{r.fullName}</td>
                      <td>{r.confirmed ? "Confirmed" : "Not confirmed"}</td>
                      <td>
                        {r.confirmed && r.address?.line1
                          ? [
                              r.address.line1,
                              r.address.line2,
                              r.address.city,
                              r.address.region,
                              r.address.postalCode,
                              r.address.country,
                            ]
                              .filter(Boolean)
                              .join(", ")
                          : r.confirmed
                            ? "No address saved"
                            : "Available after confirmation"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              className="secondary"
              disabled={!recipients.some((r) => r.confirmed)}
              onClick={() => {
                const url = URL.createObjectURL(
                  new Blob(["\uFEFF" + mailingCsv(recipients)], {
                    type: "text/csv;charset=utf-8",
                  }),
                );
                const a = document.createElement("a");
                a.href = url;
                a.download = "confirmed-participant-mailing-list.csv";
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              Download confirmed mailing list
            </button>
          </>
        )}
      </section>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
    </>
  );
}
