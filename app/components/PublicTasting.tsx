import Image from "next/image";

const sampleResults = [
  { bottle: "Maple Ridge Reserve", cup: "02", rank: "1.33", score: "83.89", ratings: [9, 9, 8, 9] },
  { bottle: "Stillwater Small Batch", cup: "01", rank: "1.67", score: "69.44", ratings: [8, 8, 9, 8] },
  { bottle: "Red Oak Single Barrel", cup: "03", rank: "3.00", score: "13.89", ratings: [9, 7, 6, 7] },
];

const tastingCriteria = ["Aroma", "Flavor", "Smoothness", "Overall enjoyment"];

export function SampleScorecard() {
  return (
    <aside className="sample-scorecard" aria-label="Sample final results">
      <p className="eyebrow">Sample reveal</p>
      <h2>Friday bourbon flight</h2>
      <p className="scorecard-note">Three tasters · Three pours · One final</p>
      <ol className="sample-results">
        {sampleResults.map(({ bottle, cup, rank, score, ratings }, index) => (
          <li key={cup} className="sample-result">
            <div className="sample-result-heading">
              <div>
                <p className="sample-place">{index === 0 ? "1st · Winner" : index === 1 ? "2nd place" : "3rd place"}</p>
                <h3>{bottle}</h3>
                <p className="scorecard-note">Cup {cup} · Avg. rank {rank}</p>
              </div>
              <p className="sample-total"><strong>{score}</strong><span>out of 100</span></p>
            </div>
            <dl className="sample-ratings">
              {tastingCriteria.map((criterion, ratingIndex) => (
                <div key={criterion}>
                  <dt>{criterion}</dt>
                  <dd>{ratings[ratingIndex]}<span>/10</span></dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ol>
      <p className="scorecard-note">
        Example results. Ratings are taster averages. Preference rank counts for 80% of the score, and each tasting criterion counts for 5%.
      </p>
    </aside>
  );
}

export function PublicTasting() {
  return (
    <>
      <section className="public-section round-walkthrough" id="play-a-round" aria-labelledby="round-heading">
        <div>
          <h2 id="round-heading">How a round is played</h2>
          <p>Here’s what a three-pour bourbon flight looks like from your seat.</p>
          <ol className="round-steps">
            <li><h3>Taste the numbered pours.</h3><p>Your host opens the flight and serves the samples in numbered cups. Everyone tastes the same pours while the bottle names stay hidden.</p></li>
            <li><h3>Score and rank on your phone.</h3><p>Rate aroma, flavor, smoothness and overall enjoyment from 1 to 10. Then give each pour a unique preference rank. For example, Cup 02 might be your favorite, Cup 01 second and Cup 03 third.</p></li>
            <li><h3>Submit your ballot.</h3><p>You can revise it until the host closes the flight. Preference is 80% of the bourbon round score. Each of the four tasting ratings contributes 5%.</p></li>
            <li><h3>Compare notes between flights.</h3><p>After closing a flight, the host can share the winning cup, cup scores, and each taster’s ranks and scores. Bottle names and owners stay hidden.</p></li>
            <li><h3>See what you picked.</h3><p>In a tournament, the top pours advance. When the event ends and the host reveals the results, each flight recap adds the bottle names and owners alongside the final standings and awards.</p></li>
          </ol>
        </div>
        <div className="phone-previews" aria-label="BlindCap mobile screenshots using sample data">
          <figure>
            <div className="phone-frame">
              <Image src="/preview/mobile-bottle.jpg" width={375} height={812} alt="BlindCap on a phone, showing the form to enter your bottle, distillery and proof" />
            </div>
            <figcaption>Add a Bottle</figcaption>
          </figure>
          <figure>
            <div className="phone-frame">
              <Image src="/preview/mobile-ballot.jpg" width={320} height={812} alt="BlindCap mobile ballot with four tasting ratings and a favorite rank for the first mystery pour" />
            </div>
            <figcaption>Score Mystery Pours</figcaption>
          </figure>
        </div>
      </section>
      <section className="public-section public-questions" id="questions" aria-labelledby="questions-heading">
        <h2 id="questions-heading">Common questions</h2>
        <div>
          <details><summary>How many tasters can join?</summary><p>Bourbon events support 2 to 16 tasters. Small groups can go straight to a final, while larger groups use qualifying flights.</p></details>
          <details><summary>Do guests need to install anything?</summary><p>BlindCap runs in a browser. Open your invitation on your phone to join.</p></details>
          <details><summary>How do I host?</summary><p>Create a profile. Once an administrator approves it, you can create an event and invite your group.</p></details>
        </div>
      </section>
    </>
  );
}
