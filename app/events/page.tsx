"use client";
import BlindParticipationDialog from "@/app/components/BlindParticipationDialog";
import { useCallback, useEffect, useState } from "react";
import { request } from "@/lib/browser";
import type { EventSummary } from "@/lib/event-management";
import DeleteEventDialog from "@/app/components/DeleteEventDialog";
import TastingHistory from "@/app/components/TastingHistory";
import CommunityDashboard from "@/app/components/CommunityDashboard";
import CreateEvent, {type EventSeries} from "@/app/components/CreateEvent";
import dynamic from "next/dynamic";
const SeriesDetail=dynamic(()=>import("@/app/components/SeriesDetail"),{loading:()=> <main className="narrow"><p>Loading series…</p></main>});
type Catalog = {
  events: EventSummary[];
  communityOwner: boolean;
  member: boolean;
};
export default function Events() {
  const [view,setView]=useState(""),[series,setSeries]=useState<EventSeries[]>([]),[route,setRoute]=useState({create:false,series:false});
  const [catalog, setCatalog] = useState<Catalog | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [target, setTarget] = useState<EventSummary | null>(null),
    [blindTarget, setBlindTarget] = useState<{
      event: EventSummary;
      mode: "lock" | "unlock";
    } | null>(null),
    [blindError, setBlindError] = useState(""),
    [busy, setBusy] = useState(false),
    [refresh, setRefresh] = useState(0);
  const load = useCallback(async () => {
    const [data, annual] = await Promise.all([request("/api/events/catalog"),request("/api/series",{operation:"list"})]);
    setCatalog(data);setSeries(annual.series);
  }, []);
  useEffect(() => {
    const params=new URLSearchParams(location.search);setRoute({create:params.has("create"),series:params.has("series")});
    load().catch((e) => setError(e.message));
  }, [load]);
  async function changeBlind(coordinatorId?: string) {
    if (!blindTarget || busy) return;
    setBusy(true);
    setBlindError("");
    try {
      await request(`/api/events/${blindTarget.event.id}/blind-access`, {
        operation: blindTarget.mode,
        revision: blindTarget.event.revision,
        title: blindTarget.event.title,
        confirmed: true,
        coordinatorId,
      });
      setNotice(
        blindTarget.mode === "lock"
          ? "Blind participation enabled. Your coordinator can now invite your profile as a taster."
          : "Emergency host access enabled. You are no longer blind for this event.",
      );
      setBlindTarget(null);
      await load();
    } catch (e) {
      setBlindError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!target || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/events/${target.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          revision: target.revision,
          title: target.title,
          confirmed: true,
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error ?? "Unable to delete this event.");
      setCatalog((current) =>
        current
          ? {
              ...current,
              events: current.events.filter((e) => e.id !== target.id),
            }
          : current,
      );
      setNotice(`“${target.title}” was deleted.`);
      setTarget(null);
      setRefresh((x) => x + 1);
    } catch (e) {
      setError((e as Error).message);
      setTarget(null);
      await load().catch(() => {});
    } finally {
      setBusy(false);
    }
  }
  const activeView=view || (catalog?.communityOwner ? "community" : "mine");
  const events =
    catalog?.events.filter(
      (e) =>
        (activeView==="community" || (activeView==="hosting" ? e.managing || e.hostedByMe : e.participating)) &&
        (filter === "all" ||
          (filter === "complete"
            ? e.phase === "complete"
            : filter === "mine"
              ? e.hostedByMe
              : e.phase !== "complete")) &&
        `${e.title} ${e.hostName}`
          .toLowerCase()
          .includes(search.trim().toLowerCase()),
    ) ?? [];
  if(route.series)return <SeriesDetail />;
  if(route.create)return <main className="narrow"><CreateEvent series={series}/>{error&&<p role="alert" className="error">{error}</p>}</main>;
  return (
    <main className="narrow events-page">
      <p className="eyebrow">YOUR BLINDCAP COMMUNITY</p>
      <div className="row-between">
        <h1>Events.</h1>
        <a href="/">← Home</a>
      </div>
      <p>Your invitations, events and annual series, together in one place.</p>
      <div className="actions section-navigation"><a className="button" href="/events?create=1">Create an Event</a><a href="/events/history">My history & awards →</a></div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {catalog ? (
        <>
          <CommunityDashboard owner={catalog.communityOwner} invitationsOnly />
          <nav className="actions event-tabs" aria-label="Event views">
            <button className={activeView==="mine"?"":"secondary"} aria-pressed={activeView==="mine"} onClick={()=>setView("mine")}>My Events</button>
            <button className={activeView==="hosting"?"":"secondary"} aria-pressed={activeView==="hosting"} onClick={()=>setView("hosting")}>Hosting</button>
            {catalog.communityOwner&&<button className={activeView==="community"?"":"secondary"} aria-pressed={activeView==="community"} onClick={()=>setView("community")}>All Community Events</button>}
          </nav>
          <section className="panel">
            <h2>Event series</h2><p>Open a series to see every year, past bottles and its running leaderboard.</p>
            {!series.length&&<p>Your series will appear here when you’re invited or create one.</p>}
            {series.map(s=><a className="event-link" href={`/events?series=${s.id}`} key={s.id}>{s.logoUrl&&<img className="series-logo-thumb" src={s.logoUrl} alt=""/>}<strong>{s.title}</strong><span>Years & results →</span></a>)}
          </section>
          <section className="panel">
            <div className="row-between">
              <h2>
                {activeView==="community"?"All Community Events":activeView==="hosting"?"Events I host":"My Events"}
              </h2>
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
            <div className="event-filters">
              <label>
                Find an event
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Event or host name"
                  maxLength={100}
                />
              </label>
              <label>
                Show events
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="all">All events</option>
                  <option value="active">In progress</option>
                  <option value="complete">Completed</option>
                  <option value="mine">Hosted by me</option>
                </select>
              </label>
            </div>
            {!events.length && <p>No events match this view.</p>}
            {events.map((e) => (
              <article className="managed-event" key={e.id}>
                <p className="eyebrow">
                  {e.blindParticipation === "blind"
                    ? "PARTICIPATING BLIND"
                    : e.hostedByMe
                      ? "YOU’RE HOSTING"
                      : `HOSTED BY ${e.hostName.toUpperCase()}`}
                </p>
                <h3>{e.title}</h3>
                <p className="muted">
                  {new Date(e.createdAt).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}{" "}
                  · {e.tasterCount} tasters ·{" "}
                  {e.phase === "complete"
                    ? e.revealed
                      ? "Completed & revealed"
                      : "Awaiting reveal"
                    : e.phase === "setup"
                      ? "Setup"
                      : `${e.phase.charAt(0).toUpperCase() + e.phase.slice(1)} round`}
                </p>
                {e.blindParticipation === "blind" && (
                  <p className="notice">
                    Your event access is limited to your taster seat. Host
                    controls stay locked.
                  </p>
                )}
                {e.blindParticipation === "unlocked" && (
                  <p className="notice">
                    Emergency access enabled. You are no longer marked blind for
                    this event.
                    {e.blindChangedAt
                      ? ` Recorded ${new Date(e.blindChangedAt).toLocaleString()}.`
                      : ""}
                  </p>
                )}
                <div className="actions">
                  {e.canLockBlind && (
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() => {
                        setBlindError("");
                        setBlindTarget({ event: e, mode: "lock" });
                      }}
                    >
                      Participate blind
                    </button>
                  )}
                  {e.canUnlockBlind && (
                    <button
                      className="secondary danger-outline"
                      disabled={busy}
                      onClick={() => {
                        setBlindError("");
                        setBlindTarget({ event: e, mode: "unlock" });
                      }}
                    >
                      Emergency host unlock
                    </button>
                  )}
                  {e.canOpen && (
                    <a className="event-open" href={`/event/${e.id}`}>
                      Open event →
                    </a>
                  )}
                  {e.canDelete && (
                    <button
                      className="secondary danger-outline"
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setError("");
                        setNotice("");
                        setTarget(e);
                      }}
                      aria-label={`Delete ${e.title}`}
                    >
                      Delete event
                    </button>
                  )}
                </div>
              </article>
            ))}
          </section>
          {catalog.member && activeView==="mine" && <TastingHistory key={refresh} />}
        </>
      ) : (
        !error && <p>Loading your events…</p>
      )}
      {blindTarget && (
        <BlindParticipationDialog
          event={blindTarget.event}
          mode={blindTarget.mode}
          busy={busy}
          error={blindError}
          onCancel={() => {
            if (!busy) setBlindTarget(null);
          }}
          onConfirm={changeBlind}
        />
      )}
      {target && (
        <DeleteEventDialog
          event={target}
          busy={busy}
          error=""
          onCancel={() => {
            if (!busy) setTarget(null);
          }}
          onConfirm={remove}
        />
      )}
    </main>
  );
}
