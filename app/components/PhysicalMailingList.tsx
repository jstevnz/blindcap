"use client";
import {useState} from "react";
import {request} from "@/lib/browser";
import type {MailingAddress} from "./MailingAddress";
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
export default function PhysicalMailingList({id}:{id:string}) {
 const [recipients,setRecipients]=useState<Recipient[]|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
 async function run(f:()=>Promise<void>){setBusy(true);setError("");try{await f();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <section className="panel"><details><summary>Physical Mailing List (optional)</summary>
 <p>Planning a printed invitation? Once your group is saved, use this list to prepare envelopes or download addresses for confirmed participants. You can return here anytime before the event.</p>
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
{error&&<p className="error" role="alert">{error}</p>}</details></section>;
}
