import { results, type Event } from "./engine.ts";
export type HistoryEntry = {
  personId: string;
  name: string;
  profileId?: string;
  bottle: string;
  distillery?: string;
  proof?: number;
  place?: number;
  award?: "winner" | "swill";
};
export function bottleDetails(input: Record<string, unknown>) {
  const distillery = String(input.distillery ?? "").trim();
  if (distillery.length > 150)
    throw new Error("Keep distillery under 150 characters.");
  const raw = input.proof;
  if (
    raw !== null &&
    raw !== undefined &&
    typeof raw !== "string" &&
    typeof raw !== "number"
  )
    throw new Error("Enter a numeric proof.");
  const proof =
    raw === "" || raw === null || raw === undefined ? undefined : Number(raw);
  if (
    proof !== undefined &&
    (!Number.isFinite(proof) || proof <= 0 || proof > 200)
  )
    throw new Error("Proof must be greater than 0 and no more than 200.");
  return {
    ...(distillery ? { distillery } : {}),
    ...(proof !== undefined ? { proof, abv: proof / 2 } : {}),
  };
}
export function annualYear(value: unknown) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1900 || n > 2200)
    throw new Error("Enter a year from 1900 to 2200.");
  return n;
}
export function historyEntries(value: unknown) {
  if (!Array.isArray(value) || value.length < 2 || value.length > 100)
    throw new Error("Enter 2–100 historical participants.");
  const rows = value.map((r) => {
    const name = String(r.name ?? "")
        .trim()
        .replace(/\s+/g, " "),
      bottle = String(r.bottle ?? "").trim();
    if (!name || name.length > 100 || bottle.length > 150)
      throw new Error(
        "Enter each participant name and keep bottle names under 150 characters.",
      );
    const place =
      r.place === "" || r.place === undefined ? undefined : Number(r.place);
    if (
      place !== undefined &&
      (!Number.isInteger(place) || place < 1 || place > 100)
    )
      throw new Error("Placements must be whole numbers from 1 to 100.");
    if (r.award && !["winner", "swill"].includes(r.award))
      throw new Error("Choose a valid award.");
    return {
      name,
      bottle,
      ...bottleDetails(r),
      ...(place ? { place } : {}),
      ...(r.award ? { award: r.award as "winner" | "swill" } : {}),
      ...(r.profileId ? { profileId: String(r.profileId) } : {}),
    };
  });
  const accounts=rows.map(r=>r.profileId).filter(Boolean);
  if(new Set(accounts).size!==accounts.length)throw new Error('A member can appear only once in a historical year.');
  if (new Set(rows.map((r) => r.name.toLowerCase())).size !== rows.length)
    throw new Error("Use each historical participant only once per year.");
  if (
    rows.filter((r) => r.award === "winner").length !== 1 ||
    rows.filter((r) => r.award === "swill").length !== 1
  )
    throw new Error(
      "Choose exactly one trophy winner and one Swill recipient.",
    );
  const winner = rows.find((r) => r.award === "winner")!,
    swill = rows.find((r) => r.award === "swill")!;
  if (winner.place !== undefined && winner.place !== 1)
    throw new Error("The trophy winner must have first place.");
  if (
    swill.place !== undefined &&
    rows.some((r) => r.place !== undefined && r.place > swill.place!)
  )
    throw new Error(
      "The Swill recipient must have the lowest recorded placement.",
    );
  return rows;
}
export function revealedEntries(e: Event): HistoryEntry[] | null {
  if (e.phase !== "complete" || !e.revealed) return null;
  const standings = results(e),
    last = standings.at(-1);
  return standings.map((r, i) => {
    const b = e.bottles.find((b) => b.id === r.bottleId)!,
      p = e.participants.find((p) => p.id === b.ownerId)!;
    return {
      personId: p.accountId
        ? `profile:${p.accountId}`
        : `guest:${e.id}:${p.id}`,
      name: p.name,
      ...(p.accountId ? { profileId: p.accountId } : {}),
      bottle: b.name,
      ...bottleDetails(b),
      place: r.place,
      ...(i === 0
        ? { award: "winner" as const }
        : r === last
          ? { award: "swill" as const }
          : {}),
    };
  });
}
export function leaderboard(
  editions: { year: number; entries: HistoryEntry[] | null }[],
) {
  const map = new Map<
    string,
    {
      personId: string;
      name: string;
      profileId?: string;
      wins: number;
      swills: number;
      years: number[];
    }
  >();
  for (const edition of editions)
    for (const p of edition.entries ?? []) {
      const key = p.profileId ? `profile:${p.profileId}` : p.personId;
      const row = map.get(key) ?? {
        personId: key,
        name: p.name,
        profileId: p.profileId,
        wins: 0,
        swills: 0,
        years: [],
      };
      row.wins += Number(p.award === "winner");
      row.swills += Number(p.award === "swill");
      if (!row.years.includes(edition.year)) row.years.push(edition.year);
      map.set(key, row);
    }
  return [...map.values()].sort(
    (a, b) =>
      b.wins - a.wins || a.swills - b.swills || a.name.localeCompare(b.name),
  );
}
