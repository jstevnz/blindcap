import type { Event, Actor } from "./engine.ts";
import { snapshot } from "./engine.ts";
export type Profile = {
  id: string;
  username: string;
  display_name: string;
  email: string;
  bio: string;
  discoverable: boolean;
  role: "owner" | "member";
  status: "pending" | "active" | "suspended";
};
export function profileFields(input: Record<string, unknown>) {
  const username = String(input.username ?? "")
      .trim()
      .toLowerCase(),
    display_name = String(input.displayName ?? "").trim(),
    bio = String(input.bio ?? "").trim();
  if (!/^[a-z][a-z0-9_]{2,23}$/.test(username))
    throw new Error(
      "Use a username of 3–24 letters, numbers or underscores, starting with a letter.",
    );
  if (!display_name || display_name.length > 80)
    throw new Error("Enter a display name of 1–80 characters.");
  if (bio.length > 500)
    throw new Error("Keep your profile description under 500 characters.");
  return {
    username,
    display_name,
    bio,
    discoverable: input.discoverable !== false,
  };
}
export function checkPassword(value: unknown): asserts value is string {
  if (typeof value !== "string" || value.length < 12 || value.length > 128)
    throw new Error("Use a password between 12 and 128 characters.");
}
export function publicProfile(p: Profile) {
  return {
    id: p.id,
    username: p.username,
    displayName: p.display_name,
    bio: p.bio,
  };
}
export function historyFor(e: Event, a: Actor) {
  if (e.phase !== "complete" || !e.revealed) return null;
  const s = snapshot(e, a);
  const ownBottle = e.bottles.find((b) => b.ownerId === s.participantId);
  return {
    id: e.id,
    title: e.title,
    host: e.ownerId === a.id,
    bottle: ownBottle
      ? {
          name: ownBottle.name,
          number: ownBottle.number,
          result: s.results?.find((r) => r.bottleId === ownBottle.id) ?? null,
        }
      : null,
    ballots: s.groups
      .filter((g) => g.myBallot)
      .map((g) => ({
        name: g.name,
        runoff: g.runoff,
        entries: [...g.myBallot!.entries]
          .sort((a, b) => a.rank - b.rank)
          .map((x) => ({
            ...x,
            bottleName:
              e.bottles.find((b) => b.id === x.bottleId)?.name ??
              "Unknown bottle",
          })),
      })),
  };
}
