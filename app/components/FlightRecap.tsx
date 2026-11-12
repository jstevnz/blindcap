import type { Snapshot } from "@/lib/engine";

type Flight = Snapshot["groups"][number];

export default function FlightRecap({ flight }: { flight: Flight }) {
  const recap = flight.recap;
  if (!recap) return null;
  const cups = [...recap.cups].sort((a, b) => a.cup - b.cup);
  const leaders = recap.cups.filter((cup) => cup.place === 1);
  const splits = cups.filter((cup) => cup.first && cup.last);

  return (
    <section className="panel">
      <h3>{flight.name}</h3>
      <p>
        <strong>{leaders.length === 1 ? "Flight winner" : "Joint leaders"}</strong>
        {" · "}
        {leaders.map((cup) => cup.bottle ? `Cup ${cup.cup} (${cup.bottle})` : `Cup ${cup.cup}`).join(", ")}
      </p>
      <div className="table-scroll">
        <table>
          <caption>Flight scores</caption>
          <thead>
            <tr><th scope="col">Place</th><th scope="col">Cup</th><th scope="col">Score</th><th scope="col">First</th><th scope="col">Last</th></tr>
          </thead>
          <tbody>
            {recap.cups.map((cup) => (
              <tr key={cup.cup}>
                <td>{cup.place}</td>
                <th scope="row">
                  Cup {cup.cup}
                  {cup.bottle && <small className="flight-recap-identity">{cup.bottle}{cup.owner && ` · ${cup.owner}`}</small>}
                </th>
                <td>{cup.score.toFixed(2)}</td><td>{cup.first}</td><td>{cup.last}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {splits.map((cup) => (
        <p key={cup.cup} className="notice">
          <strong>Split opinions on Cup {cup.cup}.</strong> {cup.first} ranked it first and {cup.last} ranked it last.
        </p>
      ))}
      <details>
        <summary>See everyone’s rankings</summary>
        <div className="table-scroll">
          <table>
            <caption>Rank and ballot score. Rank 1 is favorite.</caption>
            <thead>
              <tr><th scope="col">Taster</th>{cups.map((cup) => <th scope="col" key={cup.cup}>Cup {cup.cup}</th>)}</tr>
            </thead>
            <tbody>
              {recap.rankings.map((ballot, index) => (
                <tr key={index}>
                  <th scope="row">{ballot.taster}</th>
                  {cups.map((cup) => {
                    const entry = ballot.entries[cup.cup];
                    return (
                      <td key={cup.cup}>
                        {entry ? <>#{entry.rank}<small className="flight-recap-identity">{entry.score.toFixed(2)} pts</small></> : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
