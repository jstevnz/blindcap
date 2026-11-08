"use client";
import { useCallback, useEffect, useState } from "react";
import { request } from "@/lib/browser";
import type { EventSummary } from "@/lib/event-management";
import DeleteEventDialog from "@/app/components/DeleteEventDialog";
import TastingHistory from "@/app/components/TastingHistory";
type Catalog = {
  events: EventSummary[];
  communityOwner: boolean;
  member: boolean;
};
export default function Events() {
  const [catalog, setCatalog] = useState<Catalog | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [target, setTarget] = useState<EventSummary | null>(null),
    [busy, setBusy] = useState(false),
    [refresh, setRefresh] = useState(0);
  const load = useCallback(async () => {
    const data = await request("/api/events/catalog");
    setCatalog(data);
  }, []);
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);
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
  const events =
    catalog?.events.filter(
      (e) =>
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
  return (
    <main className="narrow events-page">
      <p className="eyebrow">YOUR BLINDCAP COMMUNITY</p>
      <div className="row-between">
        <h1>Events.</h1>
        <a href="/">← Home</a>
      </div>
      <p>
        {catalog?.communityOwner
          ? "You can see and delete every community event."
          : "Open your events and review your history. You can delete only events you created and host."}
      </p>
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
          <section className="panel">
            <div className="row-between">
              <h2>
                {catalog.communityOwner
                  ? "All community events"
                  : "Your events"}
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
                  {e.hostedByMe
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
                <div className="actions">
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
          {catalog.member && <TastingHistory key={refresh} />}
        </>
      ) : (
        !error && <p>Loading your events…</p>
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
