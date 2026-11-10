"use client";
import EventTypePicker from "@/app/components/EventTypePicker";
import { useEffect, useState } from "react";
import { request } from "@/lib/browser";
import MemberPicker from "@/app/components/MemberPicker";
import SeriesLogoEditor, {
  prepareSeriesLogo,
  uploadSeriesLogo,
} from "@/app/components/SeriesLogo";
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
  const [list, setList] = useState<Series[]>([]),
    [detail, setDetail] = useState<Detail | null>(null),
    [canCreate, setCanCreate] = useState(false),
    [title, setTitle] = useState(""),
    [logo, setLogo] = useState<File | null>(null),
    [createdId, setCreatedId] = useState<string | null>(null),
    [winner, setWinner] = useState("Yorktown Tumbler"),
    [swill, setSwill] = useState("Swill Award"),
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
      seriesId: detail?.id ?? new URLSearchParams(location.search).get("id"),
      ...data,
    });
  }
  async function load() {
    const data = await api("list");
    setList(data.series);
    setCanCreate(data.canCreate);
    const id = new URLSearchParams(location.search).get("id");
    if (id) {
      const d = await api("detail", { seriesId: id });
      setDetail(d);
      if (d.canManage) {
        const c = await request("/api/events/catalog");
        setCatalog(
          c.events.filter(
            (e: { hostedByMe: boolean }) => c.communityOwner || e.hostedByMe,
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
  const field = (i: number, key: keyof Entry, value: string) =>
    setEntries((rows) =>
      rows.map((r, j) => (i === j ? { ...r, [key]: value } : r)),
    );
  return (
    <main className="narrow">
      <a href="/">← Home</a>
      <p className="eyebrow">EVENT SERIES & HISTORY</p>
      {detail?.logoUrl && (
        <img
          className="series-logo"
          src={detail.logoUrl}
          alt={`${detail.title} logo`}
        />
      )}
      <h1>{detail?.title ?? "Year after year."}</h1>
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
      {!detail ? (
        <>
          <p>Keep annual editions, bottle results and award totals together.</p>
          <section className="panel">
            <h2>Your event series</h2>
            {!list.length && (
              <p>
                No series yet. An invitation to an annual edition gives you
                access to its revealed history.
              </p>
            )}
            {list.map((s) => (
              <a className="event-link" key={s.id} href={`/series?id=${s.id}`}>
                {s.logoUrl && (
                  <img className="series-logo-thumb" src={s.logoUrl} alt="" />
                )}
                <strong>{s.title}</strong>
                <span>History & leaderboard →</span>
              </a>
            ))}
          </section>
          {canCreate && (
            <section className="panel">
              <h2>Create an event series</h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const selectedEventType = new FormData(e.currentTarget).get(
                    "eventType",
                  );
                  run(async () => {
                    const prepared = logo
                      ? await prepareSeriesLogo(logo)
                      : null;
                    const s = createdId
                      ? { id: createdId }
                      : await api("create", {
                          title,
                          eventType: selectedEventType,
                          winnerAward: winner,
                          swillAward: swill,
                        });
                    setCreatedId(s.id);
                    if (prepared) await uploadSeriesLogo(s.id, prepared);
                    location.href = `/series?id=${s.id}`;
                  });
                }}
              >
                <label>
                  Series name
                  <input
                    required
                    maxLength={100}
                    value={title}
                    placeholder="Yorktown Bourbon Night"
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </label>
                <EventTypePicker />
                <label>
                  Winner’s award
                  <input
                    required
                    maxLength={80}
                    value={winner}
                    onChange={(e) => setWinner(e.target.value)}
                  />
                </label>
                <label>
                  Last place award
                  <input
                    required
                    maxLength={80}
                    value={swill}
                    onChange={(e) => setSwill(e.target.value)}
                  />
                </label>
                <label>
                  Series logo (optional)
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    disabled={busy}
                    onChange={(e) => setLogo(e.target.files?.[0] ?? null)}
                  />
                </label>
                {createdId && (
                  <p>
                    The series is created. Retry the logo upload or{" "}
                    <a href={`/series?id=${createdId}`}>
                      continue without a logo
                    </a>
                    .
                  </p>
                )}
                <button disabled={busy}>
                  {createdId ? "Save logo & open series" : "Create series"}
                </button>
              </form>
            </section>
          )}
        </>
      ) : (
        <>
          <a href="/series">← All series</a>
          {detail.canManage && (
            <SeriesLogoEditor
              seriesId={detail.id}
              hasLogo={!!detail.logoUrl}
              onSaved={load}
            />
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
                  <h3>{edition.year}</h3>
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
            </>
          )}
        </>
      )}
    </main>
  );
}
