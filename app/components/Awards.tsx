import ResultPerson from "./ResultPerson";
import type { Result } from "@/lib/engine";
export default function Awards({
  results,
  owner,
  label,
  winnerAward = "Yorktown Tumbler",
  swillAward = "Swill Award",
}: {
  winnerAward?: string;
  swillAward?: string;
  results: Result[];
  owner?: (id: string) => { name: string; avatarUrl?: string | null } | undefined;
  label: (id: string) => string;
}) {
  const winner = results[0],
    loser = results.at(-1);
  if (!winner || !loser) return null;
  const winnerOwner = owner?.(winner.bottleId);
  const loserOwner = owner?.(loser.bottleId);
  return (
    <div className="award-grid">
      <section className="award winner">
        <p className="eyebrow">{winnerAward.toUpperCase()}</p>
        <span className="award-mark">✦</span>
        <h2>{label(winner.bottleId)}</h2>
        {winnerOwner && <ResultPerson {...winnerOwner} />}
        <p>First place · {winner.score.toFixed(2)} points</p>
      </section>
      <section className="award swill">
        <p className="eyebrow">{swillAward.toUpperCase()}</p>
        <span className="award-mark">↘</span>
        <h2>{label(loser.bottleId)}</h2>
        {loserOwner && <ResultPerson {...loserOwner} />}
        <p>A bottle to remember. For other reasons.</p>
      </section>
    </div>
  );
}
