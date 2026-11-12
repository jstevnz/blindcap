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

type Invitation = {
  event_id: string;
  participant_id: string;
  title: string;
  host: string;
  logoUrl?: string | null;
};

type Award = {
  seriesId: string;
  title: string;
  winnerAward: string;
  swillAward: string;
  wins: number;
  swills: number;
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
  const [invitations, setInvitations] = useState<Invitation[] | null>(null);
  const [awards, setAwards] = useState<Award[] | null>(null);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      request("/api/events/catalog"),
      request("/api/history"),
      request("/api/community", { operation: "invitations", includeLogo: true, notify: false }),
      request("/api/series", { operation: "achievements" }),
    ]).then(([catalog, history, invited, achievements]) => {
      if (!active) return;
      if (catalog.status === "fulfilled") setEvents(catalog.value.events);
      if (history.status === "fulfilled") {
        setRecaps(history.value.events.filter((event: Recap) => event.participating));
      }
      if (invited.status === "fulfilled") setInvitations(invited.value.invitations);
      if (achievements.status === "fulfilled") {
        setAwards(achievements.value.achievements.filter((award: Award) => award.wins > 0 || award.swills > 0));
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
  const participating = activeEvents?.filter((event) => event.participating);
  const featured = participating?.find((event) => event.phase !== "setup") ?? participating?.[0];
  const invitation = invitations?.[0];
  const otherEvents = activeEvents?.filter((event) => invitation || event.id !== featured?.id).slice(0, 3) ?? [];
  const placements = recaps?.flatMap((event) => event.bottle?.result ? [event.bottle.result.place] : []);
  const averagePlace = placements?.length
    ? (placements.reduce((total, place) => total + place, 0) / placements.length).toFixed(1)
    : "—";
  const firstName = profile.displayName.trim().split(/\s+/)[0] || "taster";
  const formattedDate = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(new Date());
  const owner = profile.role === "owner";
  const hasDataError = !loading && (events === null || recaps === null || invitations === null || awards === null);

  async function joinEvent(invite: Invitation) {
    if (joining) return;
    setJoining(true);
    setJoinError("");
    try {
      await request("/api/community", {
        operation: "accept",
        eventId: invite.event_id,
        participantId: invite.participant_id,
      });
      location.assign(`/event/${invite.event_id}`);
    } catch (error) {
      setJoinError((error as Error).message);
      setJoining(false);
    }
  }

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
            <div><dt>Invitations</dt><dd>{invitations?.length ?? "—"}</dd></div>
            <div><dt>Revealed tastings</dt><dd>{recaps?.length ?? "—"}</dd></div>
            <div><dt>Avg. bottle place</dt><dd>{averagePlace}</dd></div>
          </dl>
        </section>

        {loading && <BlindcapLoading label="Loading your tasting dashboard…" />}
        {hasDataError && <p className="notice" role="status">Some dashboard details couldn’t load. <LoadingLink href="/events">Open Events →</LoadingLink></p>}
        {error && <p className="error" role="alert">{error}</p>}

        {!loading && <div className="portal-grid">
          <section className="portal-card portal-feature">
            {invitation ? (
              <div className="portal-invite">
                <div>
                  <p className="eyebrow">Your newest invitation</p>
                  <h2>{invitation.title}</h2>
                  <p>Hosted by {invitation.host}</p>
                  <button className="portal-pill" type="button" disabled={joining} onClick={() => joinEvent(invitation)}>
                    {joining ? "Joining…" : "Join event"} <span aria-hidden="true">→</span>
                  </button>
                  {joinError && <p role="alert">{joinError}</p>}
                  {invitations && invitations.length > 1 && <p className="portal-more-invites"><LoadingLink href="/events">View all {invitations.length} invitations →</LoadingLink></p>}
                </div>
                {invitation.logoUrl && <img className="portal-invite-logo" src={invitation.logoUrl} alt={`${invitation.title} logo`} />}
              </div>
            ) : (
              <>
                <p className="eyebrow">{featured ? "Your tasting" : "Your invitations"}</p>
                <h2>{featured?.title ?? "Your next invitation belongs here."}</h2>
                <p>{featured
                  ? featured.phase === "setup" ? "Open the event to add your bottle and get ready." : "Return to the tasting room to pick up where you left off."
                  : invitations ? "When a host invites you to a tasting, you can join from this dashboard." : "Open Events to check your invitations."}</p>
                <LoadingLink className="button portal-pill" href={featured ? `/event/${featured.id}` : "/events"}>
                  {featured ? "Open event" : "Browse events"} <span aria-hidden="true">→</span>
                </LoadingLink>
              </>
            )}
          </section>

          <section className="portal-card">
            <div className="portal-card-heading">
              <h2>Taste profile</h2>
              <LoadingLink href="/events/history">Full history →</LoadingLink>
            </div>
            <p>Your submitted bourbons, placements, and awards.</p>
            {awards?.length ? (
              <ul className="portal-list">
                {awards.slice(0, 3).map((award) => (
                  <li key={award.seriesId}>
                    <a href={`/events?series=${award.seriesId}`}>{award.title}</a>
                    {award.wins > 0 && <small>{award.winnerAward} · {award.wins}</small>}
                    {award.swills > 0 && <small>{award.swillAward} · {award.swills}</small>}
                  </li>
                ))}
              </ul>
            ) : <p>{awards ? "Your awards will appear here after a reveal or when a historical result is linked to your profile." : "Open History & awards to see your awards."}</p>}
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
                    {event.bottle && <small>{event.bottle.name}{event.bottle.result && ` · Place ${event.bottle.result.place} · ${event.bottle.result.score.toFixed(1)} pts`}</small>}
                  </li>
                ))}
              </ul>
            ) : <p>{recaps ? "Your results will appear here once a host reveals a tasting you joined." : "Your tasting history is available from History & awards."}</p>}
          </section>

          {owner ? (
            <section className="portal-card">
              <h2>Participant directory</h2>
              <p>Search signups and see who’s approved or awaiting review.</p>
              <LoadingLink href="/members/directory">Browse all participants →</LoadingLink>
            </section>
          ) : (
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
          )}
          <section className="portal-card portal-host">
            <h2>Host a tasting</h2>
            <p>{hosted?.length ? `${hosted.length} hosted ${hosted.length === 1 ? "event" : "events"}. ` : ""}Create an event, invite your group, and run a blind tasting.</p>
            <a className="button portal-pill secondary" href="/events?create=1">Create an event <span aria-hidden="true">→</span></a>
          </section>

          <section className="portal-card portal-profile">
            <div className="portal-profile-heading">
              <Avatar name={profile.displayName} url={profile.avatarUrl} />
              <div>
                <p className="eyebrow">Your account</p>
                <h2>{profile.displayName}</h2>
              </div>
            </div>
            <LoadingLink href="/account">My profile & password →</LoadingLink>
          </section>
        </div>}
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
