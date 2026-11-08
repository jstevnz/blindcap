"use client";
import { useEffect, useState } from "react";
import { request } from "@/lib/browser";
type Invitation = {
  event_id: string;
  participant_id: string;
  title: string;
  host: string;
};
export default function CommunityDashboard({ owner }: { owner: boolean }) {
  const [invitations, setInvitations] = useState<Invitation[]>([]),
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
      {owner && (
        <section className="panel">
          <p className="eyebrow">COMMUNITY OWNER</p>
          <p>
            <a href="/members">Review pending signups →</a>
          </p>
          <h2>Invite a new member</h2>
          <p>
            New members can sign up at blindcap.net/register without an
            invitation. You approve or delete their pending profiles. You can
            also send a personal signup invitation below; new accounts still
            require your approval.
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
