export type Stage = "opening" | "semifinal" | "final";
export function validCount(n: number) {
  return Number.isInteger(n) && n >= 2 && n <= 16;
}
export function tournamentPlan(n: number) {
  if (!validCount(n))
    throw new Error("Choose a whole number of tasters from 2 to 16.");
  const groupCount = n <= 4 ? 0 : n === 5 ? 1 : n <= 8 ? 2 : n <= 11 ? 3 : 4;
  const opening = Array.from(
    { length: groupCount },
    (_, i) => Math.floor(n / groupCount) + (i < n % groupCount ? 1 : 0),
  );
  const semifinal = groupCount >= 3 ? [groupCount, groupCount] : [];
  const final = n <= 4 ? n : 4;
  const weights = semifinal.length
    ? { opening: 0.2, semifinal: 0.3, final: 0.5 }
    : opening.length
      ? { opening: 2 / 7, semifinal: 0, final: 5 / 7 }
      : { opening: 0, semifinal: 0, final: 1 };
  return {
    opening,
    semifinal,
    final,
    openingQualifiers: n === 5 ? 4 : 2,
    weights,
  };
}
