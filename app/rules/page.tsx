export default function Rules() {
  return (
    <main className="narrow">
      <p className="eyebrow">THE HOUSE RULES</p>
      <h1>A fair pour.</h1>
      <section className="panel">
        <h2>The tournament</h2>
        <p>
          All 12 tasters judge every group, including their own anonymous
          bottle. Four opening groups of three send their top two to two
          semifinals of four. Each semifinal sends two to the final four.
        </p>
        <h2>Your ballot</h2>
        <p>
          Rank every bottle from favorite to least favorite with no ties.
          Preference contributes 80% of a round score. Aroma, flavor, smoothness
          and overall enjoyment each contribute 5%.
        </p>
        <p>
          Attributes use whole numbers from 1 (lowest) to 10 (highest), mapped
          linearly to 0–100. Preference maps to 100/50/0 in groups of three and
          100/66⅔/33⅓/0 in groups of four. All 12 ballots have equal weight. You
          can edit until the host closes the group.
        </p>
        <h2>Moving on</h2>
        <p>
          The current group’s score decides advancement. Ties break by
          preference score, then overall enjoyment. A remaining tie at the
          advancement cutoff triggers a blind runoff. Runoffs use preference
          ranking only; if tied again, repeat.
        </p>
        <h2>Places 1–12</h2>
        <p>
          Finalists take places 1–4 using 20% opening, 30% semifinal and 50%
          final. Semifinal eliminations take 5–8 using 40% opening and 60%
          semifinal. Opening eliminations take 9–12 using opening scores.
          Missing stages never count as zero.
        </p>
        <p>
          Within each tier, tied scores break by weighted preference and
          weighted enjoyment. Unresolved ties share a place, except the winner
          and last place, which require a blind runoff. Opponents differ across
          groups, so placement reflects the tournament path.
        </p>
        <h2>The reveal</h2>
        <p>
          The host controls when identities, owners, results and awards are
          revealed. First place earns the Yorktown Tumbler. Last place earns the
          Swill Award. Your own ballots remain private.
        </p>
      </section>
      <a href="/">← Back to the tasting room</a>
    </main>
  );
}
