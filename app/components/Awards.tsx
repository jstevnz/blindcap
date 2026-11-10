import type { Result } from "@/lib/engine";
export default function Awards({
  results,
  label,
  winnerAward = "Yorktown Tumbler",
  swillAward = "Swill Award",
}: {
  winnerAward?: string;
  swillAward?: string;
  results: Result[];
  label: (id: string) => string;
}) {
  const winner = results[0],
    loser = results.at(-1);
  if (!winner || !loser) return null;
  return (
    <div className="award-grid">
      <section className="award winner">
        <p className="eyebrow">{winnerAward.toUpperCase()}</p>
        <span className="award-mark">✦</span>
        <h2>{label(winner.bottleId)}</h2>
        <p>First place · {winner.score.toFixed(2)} points</p>
      </section>
      <section className="award swill">
        <p className="eyebrow">{swillAward.toUpperCase()}</p>
        <span className="award-mark">↘</span>
        <h2>{label(loser.bottleId)}</h2>
        <p>A bottle to remember. For other reasons.</p>
      </section>
    </div>
  );
}
