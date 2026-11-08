"use client";
import { useEffect, useState } from "react";
import { request } from "@/lib/browser";
type History = {
  id: string;
  title: string;
  host: boolean;
  bottle: {
    name: string;
    number: number;
    result: { place: number; score: number; tier: string } | null;
  } | null;
  ballots: {
    name: string;
    runoff: boolean;
    entries: {
      bottleId: string;
      bottleName: string;
      rank: number;
      aroma: number;
      flavor: number;
      smoothness: number;
      enjoyment: number;
    }[];
  }[];
};
export default function TastingHistory() {
  const [history, setHistory] = useState<History[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    request("/api/history")
      .then((d) => {
        if (active) setHistory(d.events);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <div id="tasting-history">
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <section className="panel">
        <h2>Your tasting history</h2>
        <p>
          Only your own ballots are shown here. Results enter history after the
          host reveals the event.
        </p>
        {!history.length && <p>Your revealed events will appear here.</p>}
        {history.map((h) => (
          <details key={h.id}>
            <summary>
              {h.title}
              {h.host ? " · Host" : ""}
            </summary>
            <p>
              <a href={`/event/${h.id}`}>
                Open event & full revealed results →
              </a>
            </p>
            {h.bottle && (
              <p>
                <strong>Your bottle: {h.bottle.name}</strong>
                {h.bottle.result
                  ? ` · Place ${h.bottle.result.place} · ${h.bottle.result.score.toFixed(2)} points`
                  : ""}
              </p>
            )}
            {h.ballots.map((g, i) => (
              <details key={i}>
                <summary>
                  {g.name}
                  {g.runoff ? " · runoff" : ""}
                </summary>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th>Bourbon</th>
                        {!g.runoff && (
                          <>
                            <th>Aroma</th>
                            <th>Flavor</th>
                            <th>Smoothness</th>
                            <th>Enjoyment</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {g.entries.map((x) => (
                        <tr key={x.bottleId}>
                          <td>{x.rank}</td>
                          <td>{x.bottleName}</td>
                          {!g.runoff && (
                            <>
                              <td>{x.aroma}</td>
                              <td>{x.flavor}</td>
                              <td>{x.smoothness}</td>
                              <td>{x.enjoyment}</td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            ))}
          </details>
        ))}
      </section>
    </div>
  );
}
