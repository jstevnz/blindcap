export default function BourbonRules({
  eventId,
  title,
  winnerAward,
  swillAward,
}: {
  eventId: string;
  title: string;
  winnerAward: string;
  swillAward: string;
}) {
  return (
    <main className="narrow">
      <p className="eyebrow">BOURBON TASTING RULES</p>
      <h1>A fair pour.</h1>
      <p>{title}</p>
      <section className="panel">
        <h2>Your event, your field</h2>
        <p>
          Choose 2–16 tasters when creating an event. Everyone brings one bottle
          and judges every flight, including their own anonymous bottle. The
          count locks when the event is created; the host previews the format
          before making the draw.
        </p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Tasters</th>
                <th>Opening</th>
                <th>Semifinals</th>
                <th>Final</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>2–4</td>
                <td>None</td>
                <td>None</td>
                <td>All bottles</td>
              </tr>
              <tr>
                <td>5</td>
                <td>One group of 5; top 4 advance</td>
                <td>None</td>
                <td>4</td>
              </tr>
              <tr>
                <td>6–8</td>
                <td>Two balanced groups; top 2 each</td>
                <td>None</td>
                <td>4</td>
              </tr>
              <tr>
                <td>9–11</td>
                <td>Three balanced groups; top 2 each</td>
                <td>Two groups of 3; top 2 each</td>
                <td>4</td>
              </tr>
              <tr>
                <td>12–16</td>
                <td>Four balanced groups; top 2 each</td>
                <td>Two groups of 4; top 2 each</td>
                <td>4</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          Groups differ in size by at most one bottle and are assigned randomly.
          Each semifinal receives one qualifier from each opening group. Larger
          opening groups make qualification harder; normalization cannot remove
          differences in opponents.
        </p>
        <h2>Your ballot</h2>
        <p>
          Give every bottle a unique preference rank, favorite first. Preference
          contributes 80% of the round score. Aroma, flavor, smoothness and
          overall enjoyment each contribute 5%. Attributes use whole numbers
          from 1 (lowest) to 10 (highest), mapped linearly to 0–100.
        </p>
        <p>
          Preference maps linearly from 100 for first to 0 for last: 100/0 for
          head-to-head, 100/50/0 for three bottles, 100/66⅔/33⅓/0 for four, and
          100/75/50/25/0 for five. Every registered taster’s ballot has equal
          weight. Revise until the host closes the flight; all tasters must
          submit before closing.
        </p>
        <h2>Between flights</h2>
        <p>
          After closing a flight, the host can share a blind recap. Tasters can
          compare cup scores, see each person’s ranks and scores, and discuss
          which cups split opinions. The host opens the next flight when it is
          ready. Bottle names and owners stay hidden until the final reveal.
        </p>
        <h2>Moving on</h2>
        <p>
          Current-round scores decide advancement. Ties break by preference
          score, then overall enjoyment. An unresolved tie at the qualification
          cutoff requires a blind preference-only runoff. Repeat if still tied.
        </p>
        <h2>Final placement</h2>
        <p>
          Finalists rank first, followed by semifinal eliminations, then opening
          eliminations. Within each tier, use weighted scores from the stages
          those bottles actually tasted. Missing rounds never receive artificial
          zeros.
        </p>
        <p>
          Three-stage finalists use 20% opening, 30% semifinal and 50% final.
          Without semifinals, finalists use 2/7 opening (28.57%) and 5/7 final
          (71.43%). Final-only events use 100% final. Semifinal eliminations use
          40% opening and 60% semifinal; opening eliminations use opening scores
          only. Full precision decides results; displayed scores are rounded.
        </p>
        <p>
          Weighted preference, then weighted enjoyment break placement ties.
          Remaining ties share a place, except first and last, which require
          blind runoffs. In a fully tied head-to-head, one runoff settles both
          awards.
        </p>
        <h2>The reveal</h2>
        <p>
          Your host controls the reveal of bottle identities, owners, standings
          and awards. First earns {winnerAward}. Last earns {swillAward}.
          After the reveal, every flight recap includes the bottle names and
          owners. Individual ratings for aroma, flavor, smoothness and
          enjoyment remain private.
        </p>
      </section>
      <a href={`/event/${eventId}`}>← Back to your event</a>
    </main>
  );
}
