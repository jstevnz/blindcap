"use client";
import BlindcapLoading from "@/app/components/BlindcapLoading";
import { useEffect, useState } from "react";
import { request } from "@/lib/browser";
type History = {
  id: string;
  title: string;
  host: boolean;
  participating: boolean;
  participants: {id:string;name:string}[];
  results: {bottleId:string;bottleName:string;ownerName:string;place:number;score:number;distillery?:string;proof?:number}[];
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
type Historical={seriesId:string;title:string;year:number;eventId:string|null;winnerAward:string;swillAward:string;own:{bottle:string;award?:string};entries:{name:string;bottle:string;place?:number;award?:string}[]};
export default function TastingHistory() {
  const [upcoming,setUpcoming]=useState<{id:string;title:string;phase:string;ownBottle?:{name:string;distillery?:string;proof?:number}|null}[]>([]),[historical,setHistorical]=useState<Historical[]>([]),[loading,setLoading]=useState(true);
  const [history, setHistory] = useState<History[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    Promise.all([request("/api/history"),request("/api/events/catalog"),request("/api/series",{operation:"personal-history"})])
      .then(([d,c,annual])=>{if(active){setHistory(d.events.filter((h:History)=>h.participating));setUpcoming(d.upcoming ?? c.events.filter((e:{participating:boolean;phase:string;revealed:boolean})=>e.participating&&!(e.phase==="complete"&&e.revealed)));setHistorical(annual.records.filter((r:Historical)=>!r.eventId));}})
      .catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});
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
        <h2>My Events & tasting history</h2>
        <p>
          Revisit your submitted bottles, awards, fellow participants and revealed outcomes. Your scoring selections remain private.
        </p>
        {loading&&<BlindcapLoading label="Loading your history…" />}
        {upcoming.map(e=><a className="event-link" key={e.id} href={`/event/${e.id}`}><strong>{e.title}</strong><span>{e.phase==="setup"?"Complete event profile":"Open event"} →</span>{e.ownBottle&&<small>Your bottle: {e.ownBottle.name}{e.ownBottle.proof?` · ${e.ownBottle.proof} proof`:""}</small>}</a>)}
        {!loading&&!history.length&&!historical.length&&!upcoming.length&&<p>Your participated events will appear here. Revealed results and recorded historical years are saved here.</p>}
        {historical.map(h=><details key={`${h.seriesId}:${h.year}`}><summary>{h.title} · {h.year}</summary><p><strong>Your bottle: {h.own.bottle || "Not recorded"}</strong></p>{h.own.award&&<p>Your award: {h.own.award==="winner"?h.winnerAward:h.swillAward}</p>}<p><a href={`/events?series=${h.seriesId}`}>Open series, participants & outcomes →</a></p><ul>{h.entries.map((e,i)=><li key={i}>{e.name} · {e.bottle||"Bottle not recorded"}{e.place?` · Place ${e.place}`:""}{e.award?` · ${e.award==="winner"?h.winnerAward:h.swillAward}`:""}</li>)}</ul></details>)}
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
            {h.bottle?.result && <p>{h.bottle.result.place===1?"🏆 Winner":h.bottle.result.place===h.results.length?"Last place award":""}</p>}
            <details><summary>Participants & full results</summary><p>{h.participants.map(p=>p.name).join(", ")}</p><div className="table-scroll"><table><thead><tr><th>Place</th><th>Participant</th><th>Bottle</th><th>Score</th></tr></thead><tbody>{h.results.map(r=><tr key={r.bottleId}><td>{r.place}</td><td>{r.ownerName}</td><td>{r.bottleName}{r.distillery&&<small>{r.distillery}{r.proof?` · ${r.proof} proof`:""}</small>}</td><td>{r.score.toFixed(2)}</td></tr>)}</tbody></table></div></details>
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
