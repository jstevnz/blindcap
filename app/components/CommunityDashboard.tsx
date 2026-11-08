"use client";
import { useEffect, useState } from "react";
import { request } from "@/lib/browser";
type Invitation = {
  event_id: string;
  participant_id: string;
  title: string;
  host: string;
};
type History = {
  id: string;
  title: string;
  host: boolean;
  bottle: {
    name: string;
    number: number;
    result: { place: number; score: number; tier: string } | null;
  } | null;
  ballots: {
    name: string;
    runoff: boolean;
    entries: {
      bottleId: string;
      bottleName: string;
      rank: number;
      aroma: number;
      flavor: number;
      smoothness: number;
      enjoyment: number;
    }[];
  }[];
};
export default function CommunityDashboard({ owner }: { owner: boolean }) {
  const [invitations, setInvitations] = useState<Invitation[]>([]),
    [history, setHistory] = useState<History[]>([]),
    [email, setEmail] = useState(""),
    [inviteUrl, setInviteUrl] = useState(""),
    [communityInvites, setCommunityInvites] = useState<
      {
        id: string;
        email: string;
        expires_at: string;
        redeemed_at: string | null;
      }[]
    >([]),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    const pending = await request("/api/community", {
      operation: "invitations",
    });
    setInvitations(pending.invitations);
    const h = await request("/api/history");
    setHistory(h.events);
    if (owner) {
      const c = await request("/api/community", {
        operation: "community-invites",
      });
      setCommunityInvites(c.invitations);
    }
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [owner]);
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
  return (
    <section className="community-dashboard">
      <section className="panel">
        <div className="row-between">
          <h2>Your invitations</h2>
          <button
            className="secondary"
            disabled={busy}
            onClick={() => run(load)}
          >
            Refresh
          </button>
        </div>
        {!invitations.length && <p>No pending event invitations.</p>}
        {invitations.map((i) => (
          <div className="invite-row" key={i.event_id + i.participant_id}>
            <h3>{i.title}</h3>
            <p>Hosted by {i.host}</p>
            <div className="actions">
              <button
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await request("/api/community", {
                      operation: "accept",
                      eventId: i.event_id,
                      participantId: i.participant_id,
                    });
                    location.href = `/event/${i.event_id}`;
                  })
                }
              >
                Accept & join
              </button>
              <button
                className="secondary"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await request("/api/community", {
                      operation: "decline",
                      eventId: i.event_id,
                      participantId: i.participant_id,
                    });
                    await load();
                  })
                }
              >
                Decline
              </button>
            </div>
          </div>
        ))}
      </section>
      <section className="panel">
        <h2>Your tasting history</h2>
        <p>
          Only your own ballots are shown here. Results enter history after the
          host reveals the event.
        </p>
        {!history.length && <p>Your revealed events will appear here.</p>}
        {history.map((h) => (
          <details key={h.id}>
            <summary>
              {h.title}
              {h.host ? " · Host" : ""}
            </summary>
            <p>
              <a href={`/event/${h.id}`}>
                Open event & full revealed results →
              </a>
            </p>
            {h.bottle && (
              <p>
                <strong>Your bottle: {h.bottle.name}</strong>
                {h.bottle.result
                  ? ` · Place ${h.bottle.result.place} · ${h.bottle.result.score.toFixed(2)} points`
                  : ""}
              </p>
            )}
            {h.ballots.map((g, i) => (
              <details key={i}>
                <summary>
                  {g.name}
                  {g.runoff ? " · runoff" : ""}
                </summary>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th>Bourbon</th>
                        {!g.runoff && (
                          <>
                            <th>Aroma</th>
                            <th>Flavor</th>
                            <th>Smoothness</th>
                            <th>Enjoyment</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {g.entries.map((x) => (
                        <tr key={x.bottleId}>
                          <td>{x.rank}</td>
                          <td>{x.bottleName}</td>
                          {!g.runoff && (
                            <>
                              <td>{x.aroma}</td>
                              <td>{x.flavor}</td>
                              <td>{x.smoothness}</td>
                              <td>{x.enjoyment}</td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            ))}
          </details>
        ))}
      </section>
      {owner && (
        <section className="panel">
          <p className="eyebrow">COMMUNITY OWNER</p>
          <h2>Invite a new member</h2>
          <p>
            Only you can enroll new community members. Every member can host
            their own events. Invitations are private, email-bound and valid for
            seven days.
          </p>
          <label>
            Email address
            <input
              type="email"
              value={email}
              maxLength={254}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <div className="actions">
            <button
              disabled={busy || !email}
              onClick={() =>
                run(async () => {
                  await request("/api/community", {
                    operation: "community-invite",
                    email,
                    sendEmail: true,
                  });
                  setInviteUrl("");
                  setNotice("Community invitation accepted for emailing.");
                  await load();
                })
              }
            >
              Email community invitation
            </button>
            <button
              className="secondary"
              disabled={busy || !email}
              onClick={() =>
                run(async () => {
                  const d = await request("/api/community", {
                    operation: "community-invite",
                    email,
                    sendEmail: false,
                  });
                  setInviteUrl(d.url);
                  setNotice(
                    "Private community link created. Share it only with the invited person.",
                  );
                  await load();
                })
              }
            >
              Create private link
            </button>
          </div>
          {inviteUrl && (
            <>
              <input
                aria-label="Private community invitation"
                value={inviteUrl}
                readOnly
                onFocus={(e) => e.target.select()}
              />
              <button
                className="secondary"
                onClick={() =>
                  navigator.clipboard
                    .writeText(inviteUrl)
                    .then(() => setNotice("Community invitation copied."))
                    .catch(() =>
                      setError("Select and copy the displayed invitation."),
                    )
                }
              >
                Copy community link
              </button>
            </>
          )}
          <details>
            <summary>Recent community invitations</summary>
            {communityInvites.map((i) => (
              <div className="invite-row" key={i.id}>
                <strong>{i.email}</strong>
                <p>
                  {i.redeemed_at
                    ? "Joined"
                    : new Date(i.expires_at) < new Date()
                      ? "Expired or revoked"
                      : "Awaiting registration"}
                </p>
                {!i.redeemed_at && new Date(i.expires_at) > new Date() && (
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        await request("/api/community", {
                          operation: "revoke",
                          inviteId: i.id,
                        });
                        await load();
                      })
                    }
                  >
                    Revoke unused invitation
                  </button>
                )}
              </div>
            ))}
          </details>
        </section>
      )}
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
    </section>
  );
}
