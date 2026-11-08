import { authorized, eventSize, type Actor, type Event } from "./engine.ts";
type Membership = { status: string; role: string } | null;
export function canDeleteEvent(
  ownerId: string,
  actorId: string,
  profile: Membership,
) {
  return (
    profile?.status === "active" &&
    (ownerId === actorId || profile.role === "owner")
  );
}
export function eventSummary(
  event: Event,
  createdAt: string,
  hostName: string,
  actor: Actor,
  profile: Membership,
) {
  return {
    id: event.id,
    title: event.title,
    phase: event.phase,
    revealed: event.revealed,
    tasterCount: eventSize(event),
    createdAt,
    hostName,
    hostedByMe: event.ownerId === actor.id,
    canOpen: authorized(event, actor),
    canDelete: canDeleteEvent(event.ownerId, actor.id, profile),
    revision: event.revision,
  };
}
export type EventSummary = ReturnType<typeof eventSummary>;
