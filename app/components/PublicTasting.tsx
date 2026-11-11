import Image from "next/image";

export function SampleScorecard() {
  return (
    <aside className="sample-scorecard" aria-label="Sample final results">
      <p className="eyebrow">Sample reveal</p>
      <h2>Friday bourbon flight</h2>
      <p className="scorecard-note">Three tasters · Three pours · One final</p>
      <table>
        <thead>
          <tr><th scope="col">Place</th><th scope="col">Bottle</th><th scope="col">Cup</th></tr>
        </thead>
        <tbody>
          <tr><td>1</td><td>Maple Ridge Reserve</td><td>02</td></tr>
          <tr><td>2</td><td>Stillwater Small Batch</td><td>01</td></tr>
          <tr><td>3</td><td>Red Oak Single Barrel</td><td>03</td></tr>
        </tbody>
      </table>
      <p className="scorecard-note">Example bottles and results</p>
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
            <li><h3>See what you picked.</h3><p>In a tournament, the top pours advance. When the event ends and the host reveals the results, you can match the cup numbers to the bottles and revisit your rankings.</p></li>
          </ol>
        </div>
        <div className="phone-previews" aria-label="BlindCap mobile screenshots using sample data">
          <figure>
            <Image src="/preview/mobile-bottle.jpg" width={375} height={812} alt="BlindCap on a phone, showing the form to enter your bottle, distillery and proof" />
            <figcaption>Add your bottle</figcaption>
          </figure>
          <figure>
            <Image src="/preview/mobile-ballot.jpg" width={320} height={812} alt="BlindCap mobile ballot with four tasting ratings and a favorite rank for the first mystery pour" />
            <figcaption>Score a mystery pour</figcaption>
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
