"use client";
import { useEffect, useState } from "react";
import { request } from "@/lib/browser";
type Award = {
  seriesId: string;
  title: string;
  winnerAward: string;
  swillAward: string;
  wins: number;
  swills: number;
};
export default function ProfileAchievements() {
  const [rows, setRows] = useState<Award[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    request("/api/series", { operation: "achievements" })
      .then((d) => setRows(d.achievements))
      .catch((e) => setError(e.message));
  }, []);
  return (
    <section className="panel">
      <h2>Your trophy cabinet</h2>
      {!rows.length && !error && (
        <p>
          Your awards appear here when event results are revealed or historical
          records are connected to your profile.
        </p>
      )}
      {rows.map((r) => (
        <article key={r.seriesId}>
          <h3>
            <a href={`/events?series=${r.seriesId}`}>{r.title}</a>
          </h3>
          <p>
            {r.winnerAward}: <strong>{r.wins}</strong> · {r.swillAward}:{" "}
            <strong>{r.swills}</strong>
          </p>
        </article>
      ))}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
