import type { Event, Actor } from "./engine.ts";
type Membership = { status: string; role: string } | null;
export function isBlindLocked(e: Event, id: string) {
  return e.blindParticipantIds?.includes(id) ?? false;
}
export function canControlBlindAccess(e: Event, a: Actor, p: Membership) {
  return p?.status === "active" && (e.ownerId === a.id || p.role === "owner");
}
export function blindAccessChange(
  e: Event,
  a: Actor,
  p: Membership,
  input: {
    operation: unknown;
    revision: unknown;
    title: unknown;
    confirmed: unknown;
    coordinatorId?: unknown;
  },
  at: string,
): Event {
  if (!canControlBlindAccess(e, a, p))
    throw new Error(
      "Only the primary host or site owner can manage their blind access.",
    );
  if (
    input.revision !== e.revision ||
    input.title !== e.title ||
    input.confirmed !== true
  )
    throw new Error("Review this event in Event management and confirm again.");
  const next = structuredClone(e);
  if (input.operation === "lock") {
    if (isBlindLocked(e, a.id))
      throw new Error("You are already participating blind.");
    if (e.blindUnlockedIds?.includes(a.id))
      throw new Error(
        "Emergency access was enabled. This event cannot be marked blind for you again.",
      );
    if (e.phase !== "setup" || e.bottles.length)
      throw new Error(
        "Enable blind participation before any bottles are entered.",
      );
    const coordinator = input.coordinatorId;
    if (
      typeof coordinator !== "string" ||
      coordinator === a.id ||
      !/^[0-9a-f-]{36}$/i.test(coordinator)
    )
      throw new Error(
        "Select another approved member to coordinate the event.",
      );
    if (isBlindLocked(e, coordinator))
      throw new Error("Choose a coordinator who is not participating blind.");
    next.adminIds = (e.adminIds ?? []).filter((id) => id !== a.id);
    if (coordinator !== e.ownerId && !next.adminIds.includes(coordinator))
      next.adminIds.push(coordinator);
    if (next.adminIds.length > 8)
      throw new Error(
        "The event already has eight co-admins. Choose an existing event admin.",
      );
    next.blindParticipantIds = [...(e.blindParticipantIds ?? []), a.id];
  } else if (input.operation === "unlock") {
    if (!isBlindLocked(e, a.id))
      throw new Error("Blind participation is not locked for your account.");
    next.blindParticipantIds = (e.blindParticipantIds ?? []).filter(
      (id) => id !== a.id,
    );
    next.blindUnlockedIds = [...new Set([...(e.blindUnlockedIds ?? []), a.id])];
  } else throw new Error("Choose a valid blind participation action.");
  next.blindAccessLog = [
    ...(e.blindAccessLog ?? []),
    { actorId: a.id, action: input.operation as "lock" | "unlock", at },
  ];
  next.revision = e.revision + 1;
  return next;
}
