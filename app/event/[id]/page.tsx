"use client";
import { use, useCallback, useEffect, useRef, useState } from "react";
import type { Snapshot, Entry, Command } from "@/lib/engine";
import MemberPicker from "@/app/components/MemberPicker";
import ParticipantEnrollment from "@/app/components/ParticipantEnrollment";
import EventWelcome from "@/app/components/EventWelcome";
import PhysicalMailingList from "@/app/components/PhysicalMailingList";
import EventTeam from "@/app/components/EventTeam";
import Awards from "@/app/components/Awards";
import { request } from "@/lib/browser";
type Row = {
  distillery?: string;
  proof?: string;
  name: string;
  email: string;
  bottle: string;
  accountId?: string;
};
const blank = (count = 12): Row[] =>
  Array.from({ length: count }, () => ({ name: "", email: "", bottle: "" }));
export default function EventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [e, setEvent] = useState<Snapshot | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [tab, setTab] = useState("taste"),
    [rows, setRows] = useState<Row[]>(() => blank()),
    [confirm, setConfirm] = useState<Command | null>(null),
    [inviteLinks, setInviteLinks] = useState<Record<string, string>>({}),
    [deliveryEmails, setDeliveryEmails] = useState<Record<string, string>>({}),
    [emailed, setEmailed] = useState<Record<string, string>>({});
  const initialized = useRef(false);
  const load = useCallback(async () => {
    const data: Snapshot = await request(`/api/events/${id}`);
    if (!initialized.current && data.admin && data.workflowVersion === 2)
      setTab("host");
    setEvent((prev) => (!prev || data.revision >= prev.revision ? data : prev));
    if (!initialized.current && data.admin) {
      initialized.current = true;
      if (!data.participants.length) setRows(blank(data.tasterCount));
      if (data.participants.length)
        setRows(
          data.participants.map((p, i) => ({
            name: p.name,
            email: "email" in p ? String(p.email) : "",
            accountId:
              "accountId" in p && typeof p.accountId === "string"
                ? p.accountId
                : undefined,
            distillery: (() => {
              const b = data.bottles.find(
                (b) => "ownerId" in b && b.ownerId === p.id,
              );
              return b && "distillery" in b ? (b.distillery ?? "") : "";
            })(),
            proof: (() => {
              const b = data.bottles.find(
                (b) => "ownerId" in b && b.ownerId === p.id,
              );
              return b && "proof" in b && b.proof !== undefined
                ? String(b.proof)
                : "";
            })(),
            bottle: (() => {
              const b = data.bottles.find(
                (b) => "ownerId" in b && b.ownerId === p.id,
              );
              return b && "name" in b ? b.name : "";
            })(),
          })),
        );
    }
  }, [id]);
  useEffect(() => {
    load().catch((x) => setError(x.message));
  }, [load]);
  const hasOpenFlight = e?.groups.some((g) => g.status === "open") ?? false;
  useEffect(() => {
    if (e?.phase === "complete" && e.revealed) return;
    const timer = setInterval(
      () => {
        if (document.visibilityState === "visible") load().catch(() => {});
      },
      hasOpenFlight ? 5000 : 15000,
    );
    return () => clearInterval(timer);
  }, [load, e?.phase, e?.revealed, hasOpenFlight]);
  async function send(c: Command) {
    if (!e) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const data = await request(`/api/events/${id}`, {
        ...c,
        revision: e.revision,
      });
      setEvent(data);
      setNotice(
        c.type === "ballot"
          ? "Ballot saved. You can revise it until the group closes."
          : "Saved.",
      );
      if (c.type === "setup") initialized.current = false;
    } catch (x) {
      setError((x as Error).message);
      await load().catch(() => {});
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }
  const bottle = (bid: string) => e?.bottles.find((b) => b.id === bid);
  const label = (bid: string) => {
    const b = bottle(bid);
    return b && "name" in b
      ? b.name
      : `Bottle ${String(b?.number ?? "?").padStart(2, "0")}`;
  };
  if (!e)
    return (
      <main className="narrow">
        <p className="eyebrow">THE TASTING ROOM</p>
        <h1>Pull up a chair.</h1>
        {error ? (
          <p role="alert" className="error">
            {error} <a href="/">Return to sign in</a>
          </p>
        ) : (
          <p>Loading your event…</p>
        )}
      </main>
    );
  if (e.workflowVersion === 2 && !e.admin && e.phase === "setup")
    return <EventWelcome id={id} />;
  const current = e.groups.find((g) => g.status === "open");
  const myBottle = e.bottles.find(
    (b) => "ownerId" in b && b.ownerId === e.participantId,
  );
  const ownResult = e.results?.find((r) => r.bottleId === myBottle?.id);
  return (
    <main className="event-main">
      <div className="event-heading">
        <div>
          <p className="eyebrow">
            {e.admin ? "THE HOST’S TABLE" : "YOUR SEAT AT THE TABLE"}
          </p>
          {e.series?.logoUrl && (
            <img
              className="series-logo"
              src={e.series.logoUrl}
              alt={`${e.series.title} logo`}
            />
          )}
          <h1>{e.title}</h1>
          {e.series && (
            <p>
              <a href={`/series?id=${e.series.id}`}>
                {e.series.title}: annual history & leaderboard →
              </a>
            </p>
          )}
          {e.participantId && (
            <p className="muted">
              Tasting as{" "}
              {e.participants.find((p) => p.id === e.participantId)?.name}
            </p>
          )}
        </div>
        <span className="pill">
          {e.revealed
            ? "REVEALED"
            : e.phase === "complete"
              ? "AWAITING REVEAL"
              : e.phase.toUpperCase()}
        </span>
      </div>
      {e.blindParticipation === "blind" && (
        <p className="notice">
          You’re participating blind. You have the same access as any other
          taster until the reveal.
        </p>
      )}
      {e.blindParticipation === "unlocked" && (
        <p className="notice">
          Emergency host access is enabled. You are no longer marked blind for
          this event.
        </p>
      )}
      <nav className="tabs" aria-label="Event views">
        {["taste", ...(e.admin ? ["host"] : []), "results"].map((t) => (
          <button
            key={t}
            className={tab === t ? "active" : ""}
            onClick={() => setTab(t)}
          >
            {t === "taste"
              ? "Tasting room"
              : t === "host"
                ? "Host controls"
                : "The reveal"}
          </button>
        ))}
      </nav>
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
      {tab === "taste" && (
        <>
          <section className="flight-banner">
            <p className="eyebrow">{current ? "NOW POURING" : "THE EVENING"}</p>
            <h2>
              {current
                ? current.name
                : e.phase === "setup"
                  ? "The host is setting the table."
                  : e.phase === "complete"
                    ? "The ballots are in."
                    : e.workflowVersion === 2 &&
                        e.groups.every((g) => g.status === "waiting")
                      ? "The event is ready to begin."
                      : "A moment between pours."}
            </h2>
            <p>
              {current
                ? `${current.bottleIds.length} anonymous pours. Take your time; trust your taste.`
                : e.revealed
                  ? "Visit The reveal to meet the bottles."
                  : "Your next flight will appear here when the host opens it."}
            </p>
            {current && (
              <>
                <progress
                  max={e.tasterCount}
                  value={current.submitted}
                  aria-label={`${current.submitted} of ${e.tasterCount} tasters submitted`}
                />
                <p className="fine">
                  {current.submitted} OF {e.tasterCount} TASTERS SUBMITTED
                </p>
              </>
            )}
          </section>
          {current && e.participantId ? (
            <Ballot
              key={current.id}
              group={current}
              eventId={id}
              participantId={e.participantId}
              busy={busy}
              send={send}
              bottleNumber={(bid) =>
                current.cupNumbers?.[bid] ?? bottle(bid)?.number ?? 0
              }
            />
          ) : current ? (
            <p className="panel">
              You’re hosting this event. To taste, add your signed-in email
              among the {e.tasterCount} participants before the draw.
            </p>
          ) : null}
          <section className="panel">
            <p className="eyebrow">THE ROAD TO THE TUMBLER</p>
            <p className="fine">
              {e.plan.opening.length
                ? `Opening ${(e.plan.weights.opening * 100).toFixed(2)}% · `
                : ""}
              {e.plan.semifinal.length ? "Semifinal 30% · " : ""}Final{" "}
              {(e.plan.weights.final * 100).toFixed(2)}%. Preference contributes
              80% of each round.
            </p>
            <div className="stage-strip">
              {[
                ...(e.plan.opening.length ? ["opening"] : []),
                ...(e.plan.semifinal.length ? ["semifinal"] : []),
                "final",
              ].map((s, i) => (
                <div key={s} className={e.phase === s ? "selected" : ""}>
                  <span>0{i + 1}</span>
                  <h3>
                    {s === "opening"
                      ? "Opening flights"
                      : s === "semifinal"
                        ? "Semifinals"
                        : e.plan.final === 2
                          ? "Head-to-head"
                          : `Final ${e.plan.final}`}
                  </h3>
                  <p>
                    {s === "opening"
                      ? `${e.tasterCount} bottles → ${e.plan.opening.length * e.plan.openingQualifiers}`
                      : s === "semifinal"
                        ? `${e.plan.semifinal.reduce((a, b) => a + b, 0)} bottles → 4`
                        : "One champion"}
                  </p>
                </div>
              ))}
            </div>
            {e.eventType === "bourbon-tasting" && (
              <a href={`/event/${id}/rules`}>
                Read the Bourbon Tasting rules →
              </a>
            )}
          </section>
        </>
      )}
      {tab === "host" && e.admin && (
        <>
          <EventTeam id={id} onChanged={load} />
          {e.workflowVersion === 2 && (
            <ParticipantEnrollment
              e={e}
              send={send}
              refresh={load}
              busy={busy}
            />
          )}
          {e.workflowVersion !== 2 && e.participants.length > 0 && <PhysicalMailingList id={id} />}
          {e.phase === "setup" ? (
            e.workflowVersion === 2 ? null : (
              <section className="panel">
                <p className="eyebrow">BEFORE THE FIRST POUR</p>
                <h2>Set the table for {e.tasterCount}.</h2>
                <p className="notice">
                  {e.plan.opening.length
                    ? `Opening groups: ${e.plan.opening.join(" + ")} → `
                    : ""}
                  {e.plan.semifinal.length
                    ? `Semifinals: ${e.plan.semifinal.join(" + ")} → `
                    : ""}
                  {e.plan.final === 2
                    ? "Head-to-head final"
                    : `Final of ${e.plan.final}`}
                  .
                </p>
                <p>
                  Each row pairs a taster with the bottle they brought. Search
                  for a community profile, or enter a guest. Guest emails are
                  optional. If you are tasting, select your own community
                  profile on your row. Bottle numbers follow row order; wrap and
                  label each bottle before tasting.
                </p>
                <form
                  onSubmit={(ev) => {
                    ev.preventDefault();
                    send({
                      type: "setup",
                      participants: rows.map((r) => ({
                        name: r.name,
                        email: r.email,
                        ...(r.accountId ? { accountId: r.accountId } : {}),
                      })),
                      bottles: rows.map((r, i) => ({
                        name: r.bottle,
                        distillery: r.distillery,
                        proof: r.proof,
                        ownerIndex: i,
                      })),
                    });
                  }}
                >
                  <div className="setup-grid">
                    {rows.map((r, i) => (
                      <fieldset key={i}>
                        <legend>BOTTLE {String(i + 1).padStart(2, "0")}</legend>
                        <MemberPicker
                          selected={
                            r.accountId
                              ? { id: r.accountId, name: r.name }
                              : undefined
                          }
                          onSelect={(p) =>
                            setRows((current) =>
                              current.map((x, j) =>
                                j === i
                                  ? {
                                      ...x,
                                      name: p.displayName,
                                      email: "",
                                      accountId: p.id,
                                    }
                                  : x,
                              ),
                            )
                          }
                          onClear={() =>
                            setRows((current) =>
                              current.map((x, j) =>
                                j === i
                                  ? {
                                      ...x,
                                      name: "",
                                      email: "",
                                      accountId: undefined,
                                    }
                                  : x,
                              ),
                            )
                          }
                        />
                        {(["name", "email", "bottle"] as const).map((k) => (
                          <label key={k}>
                            {k === "name"
                              ? "Taster"
                              : k === "email"
                                ? "Email (optional)"
                                : "Bourbon name"}
                            <input
                              type={k === "email" ? "email" : "text"}
                              maxLength={
                                k === "bottle" ? 150 : k === "email" ? 254 : 100
                              }
                              disabled={!!r.accountId && k !== "bottle"}
                              value={r[k]}
                              required={k !== "email"}
                              onChange={(ev) =>
                                setRows(
                                  rows.map((x, j) =>
                                    j === i
                                      ? { ...x, [k]: ev.target.value }
                                      : x,
                                  ),
                                )
                              }
                            />
                          </label>
                        ))}
                        <label>
                          Distillery (optional)
                          <input
                            maxLength={150}
                            value={r.distillery ?? ""}
                            onChange={(ev) =>
                              setRows(
                                rows.map((x, j) =>
                                  j === i
                                    ? { ...x, distillery: ev.target.value }
                                    : x,
                                ),
                              )
                            }
                          />
                        </label>
                        <label>
                          Proof (optional)
                          <input
                            type="number"
                            min="0.1"
                            max="200"
                            step="any"
                            value={r.proof ?? ""}
                            onChange={(ev) =>
                              setRows(
                                rows.map((x, j) =>
                                  j === i
                                    ? { ...x, proof: ev.target.value }
                                    : x,
                                ),
                              )
                            }
                          />
                        </label>
                        {r.proof && (
                          <p className="fine">ABV: {Number(r.proof) / 2}%</p>
                        )}
                      </fieldset>
                    ))}
                  </div>
                  <button disabled={busy}>Save participants & bottles</button>
                </form>
                {e.bottles.length === e.tasterCount && (
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() => setConfirm({ type: "start" })}
                  >
                    Lock setup & draw tournament →
                  </button>
                )}
              </section>
            )
          ) : (
            <>
              <section className="panel">
                <p className="eyebrow">CONTROL THE EVENING</p>
                <h2>
                  {e.phase === "complete"
                    ? "Ready for the reveal."
                    : "One flight at a time."}
                </h2>
                <p>
                  Participants refresh automatically. Close a group after all{" "}
                  {e.tasterCount}
                  ballots arrive, then open the next. Scores below are visible
                  only to you.
                </p>
                <div className="actions">
                  {(e.phase === "opening" || e.phase === "semifinal") && (
                    <button
                      disabled={busy}
                      onClick={() => send({ type: "advance" })}
                    >
                      Advance to next stage
                    </button>
                  )}
                  {e.phase === "final" && (
                    <button
                      disabled={busy}
                      onClick={() => send({ type: "finish" })}
                    >
                      Finalize results & check award ties
                    </button>
                  )}
                  {e.phase === "complete" && !e.revealed && (
                    <button
                      disabled={busy}
                      onClick={() => setConfirm({ type: "reveal" })}
                    >
                      Reveal bottles & awards ✦
                    </button>
                  )}
                </div>
              </section>
              {e.groups.map((g) => (
                <section className="panel" key={g.id}>
                  <div className="row-between">
                    <h2>
                      {g.name}
                      {g.runoff ? " · runoff" : ""}
                    </h2>
                    <span className="pill">{g.status}</span>
                  </div>
                  <p>{g.bottleIds.map(label).join(" · ")}</p>
                  <progress
                    max={e.tasterCount}
                    value={g.submitted}
                    aria-label={`${g.submitted} of ${e.tasterCount} submitted`}
                  />
                  <p>
                    {g.submitted}/{e.tasterCount} submitted
                  </p>
                  <div className="participant-chips">
                    {e.participants.map((p) => (
                      <span
                        key={p.id}
                        className={g.submittedIds?.includes(p.id) ? "done" : ""}
                      >
                        {g.submittedIds?.includes(p.id) ? "✓ " : ""}
                        {p.name}
                      </span>
                    ))}
                  </div>
                  {g.pourGuide && (
                    <section className="pour-sheet">
                      <h3>Private pour sheet</h3>
                      <p>
                        Keep bottles and this sheet out of sight. Wrap and label
                        each bottle with its bottle number. Use identical cups
                        and equal pours. Give every taster the same numbered
                        cups for this flight and judge every cup.
                      </p>
                      <ol>
                        {g.pourGuide.map((row) => (
                          <li key={row.cup}>
                            <strong>Cup {row.cup}</strong> ← covered bottle{" "}
                            {row.bottleNumber}: {row.name} · {row.owner}
                          </li>
                        ))}
                      </ol>
                      <p className="fine">
                        Cup numbers are freshly randomized for each flight,
                        including later rounds. Do not reuse an earlier pour
                        sheet.
                      </p>
                    </section>
                  )}
                  {g.status === "waiting" && (
                    <button
                      disabled={busy || !!current}
                      onClick={() => send({ type: "open", groupId: g.id })}
                    >
                      Begin this flight
                    </button>
                  )}
                  {g.status === "open" && (
                    <button
                      disabled={busy || g.submitted < e.tasterCount}
                      onClick={() =>
                        setConfirm({ type: "close", groupId: g.id })
                      }
                    >
                      Close & lock ballots
                    </button>
                  )}
                  {g.scores && (
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Bottle</th>
                            <th>Round score</th>
                            <th>Preference</th>
                            <th>Enjoyment</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...g.scores]
                            .sort((a, b) => b.score - a.score)
                            .map((s) => (
                              <tr key={s.bottleId}>
                                <td>{label(s.bottleId)}</td>
                                <td>{s.score.toFixed(2)}</td>
                                <td>{s.preference.toFixed(2)}</td>
                                <td>{s.enjoyment.toFixed(2)}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              ))}
            </>
          )}
          {e.workflowVersion !== 2 && (
            <section className="panel">
              <h3>Private guest invitations</h3>
              <p>
                Each link signs in one assigned taster. Links expire after 72
                hours and work once. Share each link privately. A replacement
                invalidates the previous unused link and, once redeemed,
                replaces that seat’s earlier guest access.
              </p>
              {e.phase === "setup" ? (
                <p>
                  Save your participants and lock the draw before creating
                  invitations.
                </p>
              ) : (
                e.participants.map((p) =>
                  "accountId" in p && p.accountId ? (
                    <div className="invite-row" key={p.id}>
                      <strong>{p.name}</strong>
                      <p>
                        Community member ·{" "}
                        {e.memberInvitations.find(
                          (i) => i.participantId === p.id,
                        )?.status ?? "pending"}
                      </p>
                      <p>
                        They can sign in and accept this event from their own
                        dashboard.
                      </p>
                      {(e.memberInvitations.find(
                        (i) => i.participantId === p.id,
                      )?.status ?? "pending") === "pending" && (
                        <button
                          disabled={busy}
                          onClick={async () => {
                            setBusy(true);
                            setError("");
                            try {
                              await request(`/api/events/${id}/members/email`, {
                                participantId: p.id,
                              });
                              setNotice(
                                `Event invitation accepted for emailing to ${p.name}.`,
                              );
                            } catch (x) {
                              setError((x as Error).message);
                            } finally {
                              setBusy(false);
                            }
                          }}
                        >
                          Email event invitation
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="invite-row" key={p.id}>
                      <strong>{p.name}</strong>
                      <label>
                        Invitation email
                        <input
                          type="email"
                          maxLength={254}
                          value={
                            deliveryEmails[p.id] ??
                            ("invitationEmail" in p
                              ? String(p.invitationEmail)
                              : "email" in p
                                ? String(p.email)
                                : "")
                          }
                          onChange={(ev) =>
                            setDeliveryEmails((values) => ({
                              ...values,
                              [p.id]: ev.target.value,
                            }))
                          }
                        />
                      </label>
                      <button
                        className="secondary"
                        disabled={busy || !deliveryEmails[p.id]?.trim()}
                        onClick={() =>
                          send({
                            type: "delivery-email",
                            participantId: p.id,
                            email: deliveryEmails[p.id],
                          })
                        }
                      >
                        Save email address
                      </button>
                      <div className="actions">
                        <button
                          className="secondary"
                          disabled={busy}
                          onClick={async () => {
                            setBusy(true);
                            setError("");
                            try {
                              const data = await request(
                                `/api/events/${id}/invitations`,
                                { participantId: p.id },
                              );
                              setInviteLinks((links) => ({
                                ...links,
                                [p.id]: `${location.origin}/join#invite=${data.token}`,
                              }));
                              setNotice(
                                `Invitation created for ${p.name}. Copy it and share privately.`,
                              );
                            } catch (x) {
                              setError((x as Error).message);
                            } finally {
                              setBusy(false);
                            }
                          }}
                        >
                          {inviteLinks[p.id]
                            ? "Replace link"
                            : "Create private link"}
                        </button>
                        {inviteLinks[p.id] && (
                          <button
                            onClick={() =>
                              navigator.clipboard
                                .writeText(inviteLinks[p.id])
                                .then(() =>
                                  setNotice(
                                    `Private link for ${p.name} copied.`,
                                  ),
                                )
                                .catch(() =>
                                  setError(
                                    "Select the link below and copy it.",
                                  ),
                                )
                            }
                          >
                            Copy link
                          </button>
                        )}
                        {inviteLinks[p.id] && (
                          <button
                            disabled={
                              busy ||
                              !("invitationEmail" in p
                                ? p.invitationEmail
                                : "email" in p
                                  ? p.email
                                  : "") ||
                              emailed[p.id] === inviteLinks[p.id] ||
                              !!(
                                deliveryEmails[p.id] !== undefined &&
                                deliveryEmails[p.id].trim().toLowerCase() !==
                                  ("invitationEmail" in p
                                    ? p.invitationEmail
                                    : "email" in p
                                      ? p.email
                                      : "")
                              )
                            }
                            onClick={async () => {
                              setBusy(true);
                              setError("");
                              try {
                                const token = new URL(
                                  inviteLinks[p.id],
                                ).hash.slice("#invite=".length);
                                const result = await request(
                                  `/api/events/${id}/invitations/email`,
                                  { participantId: p.id, token },
                                );
                                setEmailed((sent) => ({
                                  ...sent,
                                  [p.id]: inviteLinks[p.id],
                                }));
                                setNotice(
                                  `Invitation accepted for sending to ${result.email}. Check Resend for delivery status.`,
                                );
                              } catch (x) {
                                setError((x as Error).message);
                              } finally {
                                setBusy(false);
                              }
                            }}
                          >
                            {emailed[p.id] === inviteLinks[p.id]
                              ? "Invitation emailed"
                              : "Email invitation"}
                          </button>
                        )}
                      </div>
                      {inviteLinks[p.id] && (
                        <input
                          aria-label={`Private invitation for ${p.name}`}
                          value={inviteLinks[p.id]}
                          readOnly
                          onFocus={(ev) => ev.target.select()}
                        />
                      )}
                    </div>
                  ),
                )
              )}
            </section>
          )}
        </>
      )}
      {tab === "results" && (
        <>
          {!e.results ? (
            <section className="panel">
              <p className="eyebrow">THE MYSTERY CONTINUES</p>
              <h2>Good things take a little suspense.</h2>
              <p>
                {e.admin
                  ? "Finalize results after closing the final. Resolve any blind award runoffs, then reveal when you’re ready."
                  : "Your host will reveal the bottles, full standings and awards at the end of the evening."}
              </p>
            </section>
          ) : (
            <>
              {!e.revealed && (
                <p className="notice">
                  Host preview. Tasters cannot see these results until you
                  reveal.
                </p>
              )}
              <Awards
                results={e.results}
                label={label}
                winnerAward={e.series?.winnerAward}
                swillAward={e.series?.swillAward}
              />
              <section className="panel">
                <h2>The bottles</h2>
                {e.bottles.map(
                  (b) =>
                    "name" in b && (
                      <p key={b.id}>
                        <strong>{b.name}</strong>
                        {b.distillery ? ` · ${b.distillery}` : ""}
                        {b.proof
                          ? ` · ${b.proof} proof · ${b.proof / 2}% ABV`
                          : ""}
                      </p>
                    ),
                )}
              </section>
              {myBottle && ownResult && (
                <section className="panel">
                  <p className="eyebrow">YOUR BOTTLE’S NIGHT</p>
                  <h2>{label(myBottle.id)}</h2>
                  <p>
                    Place {ownResult.place} · {ownResult.score.toFixed(2)}{" "}
                    points · Reached {ownResult.tier}
                  </p>
                </section>
              )}
              <section className="panel">
                <p className="eyebrow">THE FULL FIELD</p>
                <h2>From first sip to final place.</h2>
                <p>
                  Stage reached determines the placement tier. Scores compare
                  bottles within that tier. Shared places are shown where ties
                  remain.
                </p>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Place</th>
                        <th>Bourbon / owner</th>
                        <th>Opening</th>
                        <th>Semifinal</th>
                        <th>Final</th>
                        <th>Weighted score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {e.results.map((r) => {
                        const b = bottle(r.bottleId);
                        return (
                          <tr key={r.bottleId}>
                            <td className="place">{r.place}</td>
                            <td>
                              <strong>{label(r.bottleId)}</strong>
                              <small>
                                {b && "ownerId" in b
                                  ? e.participants.find(
                                      (p) => p.id === b.ownerId,
                                    )?.name
                                  : ""}{" "}
                                · Bottle {b?.number}
                              </small>
                            </td>
                            {(["opening", "semifinal", "final"] as const).map(
                              (s) => (
                                <td key={s}>
                                  {r.stages[s]?.toFixed(2) ?? "—"}
                                </td>
                              ),
                            )}
                            <td>
                              <strong>{r.score.toFixed(2)}</strong>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
              <section className="panel">
                <h2>Your tasting journal</h2>
                <p>
                  Your private submitted ballots, including any blind runoffs.
                </p>
                {e.groups
                  .filter((g) => g.myBallot)
                  .map((g) => (
                    <details key={g.id}>
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
                            {[...g.myBallot!.entries]
                              .sort((a, b) => a.rank - b.rank)
                              .map((x) => (
                                <tr key={x.bottleId}>
                                  <td>{x.rank}</td>
                                  <td>{label(x.bottleId)}</td>
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
              </section>
            </>
          )}
        </>
      )}
      {confirm && (
        <div className="modal-backdrop">
          <section
            className="panel modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
          >
            <h2 id="confirm-title">
              {confirm.type === "start"
                ? "Ready to make the draw?"
                : confirm.type === "reveal"
                  ? "Time for the big reveal?"
                  : "Lock this flight’s ballots?"}
            </h2>
            <p>
              {confirm.type === "start"
                ? "Taster count, participant emails, bottle ownership and the tournament draw will be locked. Check setup before continuing."
                : confirm.type === "reveal"
                  ? "Every taster will be able to see bottle identities, owners, standings and awards. This reveal is permanent."
                  : `All ${e.tasterCount} ballots are in. Closing prevents further edits to this flight.`}
            </p>
            <div className="actions">
              <button disabled={busy} onClick={() => send(confirm)}>
                Confirm
              </button>
              <button className="secondary" onClick={() => setConfirm(null)}>
                Go back
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
function Ballot({
  group: g,
  eventId,
  participantId,
  busy,
  send,
  bottleNumber,
}: {
  group: Snapshot["groups"][number];
  eventId: string;
  participantId: string;
  busy: boolean;
  send: (c: Command) => Promise<void>;
  bottleNumber: (id: string) => number;
}) {
  const [entries, setEntries] = useState<Entry[]>(
    () =>
      g.myBallot?.entries ??
      g.bottleIds.map((id) => ({
        bottleId: id,
        rank: 0,
        aroma: 0,
        flavor: 0,
        smoothness: 0,
        enjoyment: 0,
      })),
  );
  const [ready, setReady] = useState(false);
  const storageKey = `ybn:${eventId}:${participantId}:${g.id}`;
  useEffect(() => {
    try {
      const draft = localStorage.getItem(storageKey);
      if (draft) {
        const parsed = JSON.parse(draft);
        if (
          Array.isArray(parsed) &&
          parsed.length === g.bottleIds.length &&
          parsed.every((x) => g.bottleIds.includes(x.bottleId))
        )
          setEntries(parsed);
      }
    } catch {}
    setReady(true);
  }, [storageKey, g.bottleIds.length]);
  useEffect(() => {
    if (ready)
      try {
        localStorage.setItem(storageKey, JSON.stringify(entries));
      } catch {}
  }, [entries, ready, storageKey]);
  function change(
    id: string,
    key: keyof Omit<Entry, "bottleId">,
    value: number,
  ) {
    setEntries((xs) =>
      xs.map((x) => (x.bottleId === id ? { ...x, [key]: value } : x)),
    );
  }
  const valid =
    entries.every(
      (x) =>
        x.rank > 0 &&
        (g.runoff ||
          [x.aroma, x.flavor, x.smoothness, x.enjoyment].every(
            (n) => n >= 1 && n <= 10,
          )),
    ) && new Set(entries.map((x) => x.rank)).size === entries.length;
  return (
    <form
      onSubmit={(ev) => {
        ev.preventDefault();
        send({
          type: "ballot",
          groupId: g.id,
          entries: entries.map((x) =>
            g.runoff
              ? { ...x, aroma: 1, flavor: 1, smoothness: 1, enjoyment: 1 }
              : x,
          ),
        });
      }}
    >
      <div className="row-between">
        <h2>{g.runoff ? "Break the tie." : "Make each sip count."}</h2>
        {g.myBallot && <span className="pill">BALLOT RECEIVED</span>}
      </div>
      <p>
        {g.runoff
          ? "Rank these tied pours. This runoff uses preference only."
          : "Rate each pour from 1–10, then give every bottle a unique preference rank."}
      </p>
      {[...entries]
        .sort((a, b) => bottleNumber(a.bottleId) - bottleNumber(b.bottleId))
        .map((x) => (
          <fieldset className="bottle-card" key={x.bottleId}>
            <legend>
              <span className="bottle-number">
                {String(bottleNumber(x.bottleId)).padStart(2, "0")}
              </span>{" "}
              THE MYSTERY POUR
            </legend>
            {!g.runoff && (
              <div className="attribute-grid">
                {(["aroma", "flavor", "smoothness", "enjoyment"] as const).map(
                  (k) => (
                    <label key={k}>
                      {k === "enjoyment"
                        ? "Overall enjoyment"
                        : k[0].toUpperCase() + k.slice(1)}
                      <select
                        aria-label={`Bottle ${bottleNumber(x.bottleId)} ${k}`}
                        value={x[k]}
                        onChange={(ev) =>
                          change(x.bottleId, k, Number(ev.target.value))
                        }
                        required
                      >
                        <option value={0}>Select 1–10</option>
                        {Array.from({ length: 10 }, (_, i) => (
                          <option key={i + 1} value={i + 1}>
                            {i + 1}
                            {i === 0
                              ? " · Lowest"
                              : i === 9
                                ? " · Highest"
                                : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                  ),
                )}
              </div>
            )}
            <label className="rank-label">
              Your preference{" "}
              <span>{g.runoff ? "RUNOFF RANKING" : "80% OF ROUND SCORE"}</span>
              <select
                aria-label={`Bottle ${bottleNumber(x.bottleId)} rank`}
                value={x.rank}
                onChange={(ev) =>
                  change(x.bottleId, "rank", Number(ev.target.value))
                }
                required
              >
                <option value={0}>Choose a rank</option>
                {entries.map((_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}
                    {i === 0
                      ? " · Favorite"
                      : i === entries.length - 1
                        ? " · Least favorite"
                        : ""}
                  </option>
                ))}
              </select>
            </label>
          </fieldset>
        ))}
      <div className="submit-bar">
        <p>
          {valid
            ? "Every pour has its place. Ready when you are."
            : "Complete every score and use each rank once."}
          <small>Your draft stays on this device until you submit.</small>
        </p>
        <button disabled={busy || !valid}>
          {busy
            ? "Saving…"
            : g.myBallot
              ? "Update my ballot"
              : "Submit my ballot"}{" "}
          <span>↗</span>
        </button>
      </div>
    </form>
  );
}
