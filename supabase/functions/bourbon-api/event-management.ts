import { isBlindLocked, canControlBlindAccess } from "./blind-access.ts";
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
    coordinatorId: event.ownerId,
    hostedByMe: event.ownerId === actor.id,
    canOpen: authorized(event, actor),
    canDelete:
      !isBlindLocked(event, actor.id) &&
      canDeleteEvent(event.ownerId, actor.id, profile),
    blindParticipation: isBlindLocked(event, actor.id)
      ? ("blind" as const)
      : event.blindUnlockedIds?.includes(actor.id)
        ? ("unlocked" as const)
        : ("standard" as const),
    canLockBlind:
      canControlBlindAccess(event, actor, profile) &&
      event.phase === "setup" &&
      !event.bottles.length &&
      !isBlindLocked(event, actor.id) &&
      !event.blindUnlockedIds?.includes(actor.id),
    canUnlockBlind:
      canControlBlindAccess(event, actor, profile) &&
      isBlindLocked(event, actor.id),
    blindChangedAt:
      event.blindAccessLog?.filter((x) => x.actorId === actor.id).at(-1)?.at ??
      null,
    revision: event.revision,
  };
}
export type EventSummary = ReturnType<typeof eventSummary>;
