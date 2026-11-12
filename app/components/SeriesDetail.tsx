"use client";
import BlindcapLoading from "@/app/components/BlindcapLoading";
import EventTypePicker from "@/app/components/EventTypePicker";
import { useEffect, useState } from "react";
import { request } from "@/lib/browser";
import MemberPicker from "@/app/components/MemberPicker";
import SeriesLogoEditor from "@/app/components/SeriesLogo";
type Entry = {
  personId?: string;
  profileId?: string;
  name: string;
  bottle: string;
  distillery?: string;
  proof?: number | string;
  place?: number | string;
  award?: string;
};
type Edition = {
  id: string;
  year: number;
  revision: number;
  source: string;
  eventId: string | null;
  eventRevision: number | null;
  eventTitle: string;
  canDelete: boolean;
  canOpen: boolean;
  phase: string;
  revealed: boolean;
  entries: Entry[] | null;
};
type Series = {
  logoUrl?: string | null;
  id: string;
  title: string;
  winnerAward: string;
  swillAward: string;
  canManage: boolean;
};
type Detail = Series & {
  editions: Edition[];
  leaderboard: {
    personId: string;
    name: string;
    wins: number;
    swills: number;
    years: number[];
  }[];
  people: { id: string; name: string; profile_id: string | null }[];
};
const empty = (): Entry[] => [
  { name: "", bottle: "", award: "winner" },
  { name: "", bottle: "", award: "swill" },
];
const currentYear = new Date().getFullYear();
export default function SeriesPage() {
  const [detail, setDetail] = useState<Detail | null>(null),
    [year, setYear] = useState(currentYear),
    [count, setCount] = useState(12),
    [coordinator, setCoordinator] = useState<
      { id: string; name: string } | undefined
    >(),
    [historyYear, setHistoryYear] = useState(currentYear - 1),
    [entries, setEntries] = useState<Entry[]>(empty),
    [editing, setEditing] = useState<Edition | null>(null),
    [selectedYear, setSelectedYear] = useState("all"),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [catalog, setCatalog] = useState<{ id: string; title: string }[]>([]),
    [attach, setAttach] = useState(""),
    [linkPerson, setLinkPerson] = useState("");
  async function api(operation: string, data: object = {}) {
    return request("/api/series", {
      operation,
      seriesId: detail?.id ?? new URLSearchParams(location.search).get("series"),
      ...data,
    });
  }
  async function load() {
    const id = new URLSearchParams(location.search).get("series");
    if (id) {
      const d = await api("detail", { seriesId: id });
      setDetail(d);
      if (d.canManage) {
        const c = await request("/api/events/catalog");
        setCatalog(
          c.events.filter(
            (e: { hostedByMe: boolean; seriesId: string | null }) => !e.seriesId && (c.communityOwner || e.hostedByMe),
          ),
        );
      }
    }
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);
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
  async function removeEdition(edition:Edition){
    if(!detail || busy)return;
    const title=edition.eventTitle || `${detail.title} ${edition.year}`;
    if(!window.confirm(`Permanently delete ${title}? This removes this year’s ${edition.eventId?"scores, invitations and tasting history":"historical results and awards"} for everyone. This cannot be undone. The series and its other years will be kept.`))return;
    await run(async()=>{
      if(edition.eventId){
        const response=await fetch(`/api/events/${edition.eventId}`,{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({revision:edition.eventRevision,title:edition.eventTitle,confirmed:true})});
        const data=await response.json();if(!response.ok)throw new Error(data.error??"Unable to delete this event.");
      }else await api("delete-history",{editionId:edition.id,year:edition.year,revision:edition.revision,title:detail.title,confirmed:true});
      if(editing?.id===edition.id){setEditing(null);setEntries(empty());}
      await load();setNotice(`${title} was deleted. The series and other years are unchanged.`);
    });
  }
  async function removeSeries() {
    if (!detail?.canManage || busy) return;
    if (!window.confirm(
      `Permanently delete “${detail.title}”? This removes its imported historical results, leaderboard, and series awards. Linked BlindCap events will become standalone events and keep their scores and invitations.`,
    )) return;
    await run(async () => {
      await api("delete-series", { title: detail.title, confirmed: true });
      location.assign("/events");
    });
  }
  const field = (i: number, key: keyof Entry, value: string) =>
    setEntries((rows) =>
      rows.map((r, j) => (i === j ? { ...r, [key]: value } : r)),
    );
  return (
    <main className="narrow">
      <a href="/events">← Events</a>
      <p className="eyebrow">EVENT SERIES & HISTORY</p>
      {detail?.logoUrl && (
        <img
          className="series-logo"
          src={detail.logoUrl}
          alt={`${detail.title} logo`}
        />
      )}
      <div className="series-title-wrap">
        <h1>{detail?.title ?? "Event series."}</h1>
      </div>
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
      {!detail ? (<BlindcapLoading label="Loading series…" />) : (
        <>
          <a href="/events">← Events</a>
          {detail.canManage && (
            <SeriesLogoEditor
              seriesId={detail.id}
              hasLogo={!!detail.logoUrl}
              onSaved={load}
            />
          )}
          {detail.canManage && (
            <section className="panel">
              <h2>Award names</h2>
              <p>These names appear in the series leaderboard, event reveals, and member trophy cabinets.</p>
              <form onSubmit={(event) => {
                event.preventDefault();
                if (busy) return;
                const values = new FormData(event.currentTarget);
                void run(async () => {
                  const saved = await api("rename-awards", {
                    winnerAward: values.get("winnerAward"),
                    swillAward: values.get("swillAward"),
                  });
                  setDetail((current) => current && ({
                    ...current,
                    winnerAward: saved.winnerAward,
                    swillAward: saved.swillAward,
                  }));
                  setNotice("Award names saved.");
                });
              }} key={JSON.stringify([detail.id, detail.winnerAward, detail.swillAward])}>
                <label>Winner award
                  <input name="winnerAward" defaultValue={detail.winnerAward} required maxLength={80} />
                </label>
                <label>Last-place award
                  <input name="swillAward" defaultValue={detail.swillAward} required maxLength={80} />
                </label>
                <button type="submit" disabled={busy}>Save award names</button>
              </form>
            </section>
          )}
          <section className="panel">
            <h2>The running leaderboard</h2>
            <p>
              {detail.winnerAward} and {detail.swillAward} totals include
              historical records and revealed Blindcap editions.
            </p>
            {!detail.leaderboard.length ? (
              <p>Award totals appear after results are recorded or revealed.</p>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Participant</th>
                      <th>{detail.winnerAward}</th>
                      <th>{detail.swillAward}</th>
                      <th>Years</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.leaderboard.map((r) => (
                      <tr key={r.personId}>
                        <td>{r.name}</td>
                        <td>{r.wins}</td>
                        <td>{r.swills}</td>
                        <td>{r.years.sort((a, b) => a - b).join(", ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <section className="panel">
            <h2>Through the years</h2>
            <label>
              Show year
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
              >
                <option value="all">All years</option>
                {detail.editions.map((e) => (
                  <option key={e.id} value={e.year}>
                    {e.year}
                  </option>
                ))}
              </select>
            </label>
            {!detail.editions.length && <p>No annual editions yet.</p>}
            {detail.editions
              .filter(
                (e) =>
                  selectedYear === "all" || String(e.year) === selectedYear,
              )
              .map((edition) => (
                <article className="edition" key={edition.id}>
                  <div className="row-between"><h3>{edition.year}</h3>{edition.canDelete&&<button type="button" className="secondary danger-outline" disabled={busy} onClick={()=>removeEdition(edition)} aria-label={`Delete ${detail.title} ${edition.year}`}>Delete event</button>}</div>
                  <p className="fine">
                    {edition.source} · {edition.phase}
                    {edition.revealed
                      ? " · Revealed"
                      : " · Results hidden until reveal"}
                  </p>
                  {edition.canOpen && edition.eventId && (
                    <a href={`/event/${edition.eventId}`}>
                      Open this edition →
                    </a>
                  )}
                  {edition.entries ? (
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Place</th>
                            <th>Participant</th>
                            <th>Bottle</th>
                            <th>Distillery</th>
                            <th>Proof / ABV</th>
                            <th>Award</th>
                          </tr>
                        </thead>
                        <tbody>
                          {edition.entries.map((r, i) => (
                            <tr key={r.personId ?? i}>
                              <td>{r.place ?? "—"}</td>
                              <td>{r.name}</td>
                              <td>{r.bottle || "Not recorded"}</td>
                              <td>{r.distillery || "—"}</td>
                              <td>
                                {r.proof
                                  ? `${r.proof} / ${Number(r.proof) / 2}%`
                                  : "—"}
                              </td>
                              <td>
                                {r.award === "winner"
                                  ? detail.winnerAward
                                  : r.award === "swill"
                                    ? detail.swillAward
                                    : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p>The entries and results are still a mystery.</p>
                  )}
                  {detail.canManage && !edition.eventId && (
                    <button
                      className="text-button"
                      onClick={() => {
                        setEditing(edition);
                        setHistoryYear(edition.year);
                        setEntries(edition.entries ?? empty());
                        document
                          .getElementById("history-form")
                          ?.scrollIntoView({ behavior: "smooth" });
                      }}
                    >
                      Edit historical record
                    </button>
                  )}
                </article>
              ))}
          </section>
          {detail.canManage && (
            <>
              <section className="panel">
                <h2>Create an annual edition</h2>
                <p>
                  The coordinator manages this edition’s setup, invitations,
                  judging and reveal. You keep control of the series.
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const selectedEventType = new FormData(e.currentTarget).get(
                      "eventType",
                    );
                    run(async () => {
                      const r = await api("create-edition", {
                        year,
                        eventType: selectedEventType,
                        tasterCount: count,
                        coordinatorId: coordinator?.id,
                      });
                      if (coordinator) {
                        await load();
                        setNotice(
                          `Annual edition created. ${coordinator.name} can open it from their Events screen.`,
                        );
                      } else location.href = `/event/${r.eventId}`;
                    });
                  }}
                >
                  <label>
                    Year
                    <input
                      required
                      type="number"
                      min={1900}
                      max={2200}
                      value={year}
                      onChange={(e) => setYear(Number(e.target.value))}
                    />
                  </label>
                  <EventTypePicker />
                  <label>
                    Tasters / bottles
                    <select
                      value={count}
                      onChange={(e) => setCount(Number(e.target.value))}
                    >
                      {Array.from({ length: 15 }, (_, i) => (
                        <option key={i} value={i + 2}>
                          {i + 2}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p>
                    {coordinator
                      ? `Coordinator: ${coordinator.name}`
                      : "You will coordinate this edition unless you select another member."}
                  </p>
                  <MemberPicker
                    selected={coordinator}
                    onSelect={(p) =>
                      setCoordinator({ id: p.id, name: p.displayName })
                    }
                    onClear={() => setCoordinator(undefined)}
                  />
                  <button disabled={busy}>Create annual edition</button>
                </form>
              </section>
              <section className="panel">
                <h2>Add an existing event to this series</h2>
                <p>Only standalone events can be added. Events already in a series stay with their current series.</p>
                {!catalog.length && <p>No standalone events are available to add.</p>}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    run(async () => {
                      await api("attach-event", { year, eventId: attach });
                      await load();
                      setNotice(
                        "Existing event linked. Its ballots are unchanged.",
                      );
                    });
                  }}
                >
                  <label>
                    Year
                    <input
                      required
                      type="number"
                      min={1900}
                      max={2200}
                      value={year}
                      onChange={(e) => setYear(Number(e.target.value))}
                    />
                  </label>
                  <label>
                    Existing event
                    <select
                      required
                      value={attach}
                      onChange={(e) => setAttach(e.target.value)}
                    >
                      <option value="">Select an event</option>
                      {catalog.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button disabled={busy}>Link existing event</button>
                </form>
              </section>
              <section className="panel" id="history-form">
                <h2>{editing ? "Edit" : "Add"} a historical year</h2>
                <p>
                  Record names and awards without recreating Blindcap scores.
                  Bottle details and placements are optional. Historical names
                  can be linked to profiles below.
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    run(async () => {
                      await api("save-history", {
                        year: historyYear,
                        entries,
                        editionId: editing?.id,
                        revision: editing?.revision,
                      });
                      setEntries(empty());
                      setEditing(null);
                      await load();
                      setNotice("Historical results saved.");
                    });
                  }}
                >
                  <label>
                    Year
                    <input
                      required
                      disabled={!!editing}
                      type="number"
                      min={1900}
                      max={2200}
                      value={historyYear}
                      onChange={(e) => setHistoryYear(Number(e.target.value))}
                    />
                  </label>
                  {entries.map((r, i) => (
                    <fieldset key={i}>
                      <legend>Participant {i + 1}</legend>
                      <MemberPicker
                        selected={
                          r.profileId
                            ? { id: r.profileId, name: r.name }
                            : undefined
                        }
                        onSelect={(p) =>
                          setEntries((rows) =>
                            rows.map((x, j) =>
                              i === j
                                ? { ...x, name: p.displayName, profileId: p.id }
                                : x,
                            ),
                          )
                        }
                        onClear={() =>
                          setEntries((rows) =>
                            rows.map((x, j) =>
                              i === j ? { ...x, profileId: undefined } : x,
                            ),
                          )
                        }
                      />
                      <label>
                        Name
                        <input
                          required
                          maxLength={100}
                          value={r.name}
                          onChange={(e) => field(i, "name", e.target.value)}
                        />
                      </label>
                      <label>
                        Bottle name (optional)
                        <input
                          maxLength={150}
                          value={r.bottle}
                          onChange={(e) => field(i, "bottle", e.target.value)}
                        />
                      </label>
                      <label>
                        Distillery (optional)
                        <input
                          maxLength={150}
                          value={r.distillery ?? ""}
                          onChange={(e) =>
                            field(i, "distillery", e.target.value)
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
                          onChange={(e) => field(i, "proof", e.target.value)}
                        />
                      </label>
                      <label>
                        Place (optional)
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={r.place ?? ""}
                          onChange={(e) => field(i, "place", e.target.value)}
                        />
                      </label>
                      <label>
                        Award
                        <select
                          value={r.award ?? ""}
                          onChange={(e) => field(i, "award", e.target.value)}
                        >
                          <option value="">No award recorded</option>
                          <option value="winner">{detail.winnerAward}</option>
                          <option value="swill">{detail.swillAward}</option>
                        </select>
                      </label>
                      {entries.length > 2 && (
                        <button
                          type="button"
                          className="text-button"
                          onClick={() =>
                            setEntries((rows) => rows.filter((_, j) => i !== j))
                          }
                        >
                          Remove participant
                        </button>
                      )}
                    </fieldset>
                  ))}
                  <div className="actions">
                    <button
                      type="button"
                      className="secondary"
                      disabled={entries.length >= 100}
                      onClick={() =>
                        setEntries([...entries, { name: "", bottle: "" }])
                      }
                    >
                      Add participant
                    </button>
                    <button disabled={busy}>Save historical year</button>
                    {editing && (
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => {
                          setEditing(null);
                          setEntries(empty());
                        }}
                      >
                        Cancel edit
                      </button>
                    )}
                  </div>
                </form>
              </section>
              {detail.people.some((p) => !p.profile_id) && (
                <section className="panel">
                  <h2>Connect historical names to profiles</h2>
                  <p>
                    Link a name once to carry its awards across all recorded
                    years onto that member’s profile.
                  </p>
                  <label>
                    Historical participant
                    <select
                      value={linkPerson}
                      onChange={(e) => setLinkPerson(e.target.value)}
                    >
                      <option value="">Choose a name</option>
                      {detail.people
                        .filter((p) => !p.profile_id)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  {linkPerson && (
                    <MemberPicker
                      onClear={() => {}}
                      onSelect={(p) => {
                        if (
                          window.confirm(
                            `Connect this historical name to ${p.displayName}?`,
                          )
                        )
                          run(async () => {
                            await api("link-person", {
                              personId: linkPerson,
                              profileId: p.id,
                            });
                            setLinkPerson("");
                            await load();
                            setNotice("Historical awards connected.");
                          });
                      }}
                    />
                  )}
                </section>
              )}
              <section className="panel">
                <h2>Delete series</h2>
                <p>Remove this series and its historical records. Linked events will become standalone events and keep their scores and invitations.</p>
                <button className="secondary danger-outline" type="button" disabled={busy} onClick={removeSeries}>
                  Delete series
                </button>
              </section>
            </>
          )}
        </>
      )}
    </main>
  );
}
