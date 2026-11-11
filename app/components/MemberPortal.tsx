"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { request } from "@/lib/browser";
import type { EventSummary } from "@/lib/event-management";
import Avatar from "./Avatar";
import BlindcapLoading from "./BlindcapLoading";
import LoadingLink from "./LoadingLink";

type PortalProfile = {
  displayName: string;
  avatarUrl?: string | null;
  role: string;
};

type Recap = {
  id: string;
  title: string;
  participating: boolean;
  bottle: { name: string; result: { place: number; score: number } | null } | null;
};

export default function MemberPortal({
  profile,
  signingOut,
  onSignOut,
  error,
}: {
  profile: PortalProfile;
  signingOut: boolean;
  onSignOut: () => void;
  error: string;
}) {
  const [events, setEvents] = useState<EventSummary[] | null>(null);
  const [recaps, setRecaps] = useState<Recap[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      request("/api/events/catalog"),
      request("/api/history"),
    ]).then(([catalog, history]) => {
      if (!active) return;
      if (catalog.status === "fulfilled") setEvents(catalog.value.events);
      if (history.status === "fulfilled") {
        setRecaps(history.value.events.filter((event: Recap) => event.participating));
      }
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const catalogOrder = new Map(events?.map((event, index) => [event.id, index]));
  const recentRecaps = [...(recaps ?? [])].sort((a, b) =>
    (catalogOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
    (catalogOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER),
  );
  const hosted = events?.filter((event) => event.hostedByMe);
  const activeEvents = events?.filter((event) => event.canOpen && (event.hostedByMe || event.managing || event.participating) && event.phase !== "complete");
  const featured = activeEvents?.find((event) => event.phase !== "setup") ?? activeEvents?.[0];
  const otherEvents = activeEvents?.filter((event) => event.id !== featured?.id).slice(0, 3) ?? [];
  const placements = recaps?.flatMap((event) => event.bottle?.result ? [event.bottle.result.place] : []);
  const averagePlace = placements?.length
    ? (placements.reduce((total, place) => total + place, 0) / placements.length).toFixed(1)
    : "—";
  const firstName = profile.displayName.trim().split(/\s+/)[0] || "taster";
  const formattedDate = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(new Date());
  const owner = profile.role === "owner";
  const hasDataError = !loading && (events === null || recaps === null);

  return (
    <div className="member-portal">
      <header className="portal-header">
        <LoadingLink href="/" aria-label="BlindCap home">
          <Image src="/brand/blindcap-wordmark.png" width={165} height={30} alt="BlindCap" />
        </LoadingLink>
        <nav aria-label="Member portal">
          <LoadingLink href="/" aria-current="page">Home</LoadingLink>
          <LoadingLink href="/events">Events</LoadingLink>
          <LoadingLink href="/events/history">History & awards</LoadingLink>
          {owner && <LoadingLink href="/members">Signup reviews</LoadingLink>}
        </nav>
        <div className="portal-header-actions">
          <a className="button portal-pill" href="/events?create=1">Host a tasting <span aria-hidden="true">→</span></a>
          <LoadingLink className="portal-profile-link" href="/account" aria-label="My profile">
            <Avatar name={profile.displayName} url={profile.avatarUrl} />
          </LoadingLink>
        </div>
      </header>

      <main className="portal-main">
        <section className="portal-welcome" aria-labelledby="portal-heading">
          <div>
            <p className="eyebrow">{formattedDate}</p>
            <h1 id="portal-heading">Welcome, <em>{firstName}.</em></h1>
            <p>Find your events, pick up where you left off, and revisit your reveals.</p>
          </div>
          <dl className="portal-stats">
            <div><dt>Events hosted</dt><dd>{hosted?.length ?? "—"}</dd></div>
            <div><dt>Revealed tastings</dt><dd>{recaps?.length ?? "—"}</dd></div>
            <div><dt>Avg. bottle place</dt><dd>{averagePlace}</dd></div>
          </dl>
        </section>

        {loading && <BlindcapLoading label="Loading your tasting dashboard…" />}
        {hasDataError && <p className="notice" role="status">Some dashboard details couldn’t load. <LoadingLink href="/events">Open Events →</LoadingLink></p>}
        {error && <p className="error" role="alert">{error}</p>}

        <div className="portal-grid">
          <section className="portal-card portal-feature">
            <p className="eyebrow">{featured?.phase === "setup" ? "Event setup" : featured ? "Tasting in progress" : "Your events"}</p>
            <h2>{featured ? featured.title : events?.length === 0 ? "Host your first tasting." : "Gather your tasting group."}</h2>
            <p>{featured
              ? featured.phase === "setup"
                ? featured.managing
                  ? "Continue setting up your roster, invitations, and bottles."
                  : "Open your event to see the tasting details and add your bottle."
                : "Return to the tasting room to pick up where you left off."
              : "Set up a blind tasting, invite your group, and reveal the results together."}</p>
            {featured
              ? <LoadingLink className="button portal-pill" href={`/event/${featured.id}`}>Open event <span aria-hidden="true">→</span></LoadingLink>
              : <a className="button portal-pill" href="/events?create=1">Host a tasting <span aria-hidden="true">→</span></a>}
          </section>

          <section className="portal-card portal-profile">
            <div className="portal-profile-heading">
              <Avatar name={profile.displayName} url={profile.avatarUrl} />
              <div>
                <p className="eyebrow">Your account</p>
                <h2>{profile.displayName}</h2>
              </div>
            </div>
            <p>Manage your photo, contact details, and password.</p>
            <LoadingLink href="/account">My profile & password →</LoadingLink>
          </section>

          <section className="portal-card">
            <div className="portal-card-heading">
              <h2>Recent reveals</h2>
              <LoadingLink href="/events/history">View history →</LoadingLink>
            </div>
            {recaps?.length ? (
              <ul className="portal-list">
                {recentRecaps.slice(0, 3).map((event) => (
                  <li key={event.id}>
                    <LoadingLink href={`/event/${event.id}`}>{event.title}</LoadingLink>
                    {event.bottle && <small>{event.bottle.name}{event.bottle.result && ` · Place ${event.bottle.result.place}`}</small>}
                  </li>
                ))}
              </ul>
            ) : <p>{recaps ? "Your results will appear here once a host reveals a tasting you joined." : "Your tasting history is available from History & awards."}</p>}
          </section>

          <section className="portal-card">
            <div className="portal-card-heading">
              <h2>At your table</h2>
              <LoadingLink href="/events">All events →</LoadingLink>
            </div>
            {otherEvents.length ? (
              <ul className="portal-list">
                {otherEvents.map((event) => (
                  <li key={event.id}>
                    <LoadingLink href={`/event/${event.id}`}>{event.title}</LoadingLink>
                    <small>{event.managing ? "Host" : "Taster"} · {event.phase === "setup" ? "Setup" : "In progress"}</small>
                  </li>
                ))}
              </ul>
            ) : <p>Open Events to check invitations, manage tastings, and browse event series.</p>}
          </section>
        </div>

        {hosted?.length === 0 && (
          <section className="portal-card portal-guide">
            <h2>Plan your first blind tasting</h2>
            <ol>
              <li><strong>Create an event.</strong> Choose a name and the number of tasters.</li>
              <li><strong>Invite your group.</strong> Ask guests to join and enter their bottles.</li>
              <li><strong>Run the flight.</strong> Serve the numbered pours, collect ballots, then reveal the results.</li>
            </ol>
            <a href="/events?create=1">Create your first event →</a>
          </section>
        )}
      </main>

      <footer className="portal-footer">
        <span>BLINDCAP</span>
        <span>Signed in as {profile.displayName}</span>
        <button className="text-button" type="button" disabled={signingOut} onClick={onSignOut}>
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </footer>
    </div>
  );
}
