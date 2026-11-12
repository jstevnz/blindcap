"use client";
import { useEffect, useState } from "react";
import { request } from "@/lib/browser";
import BottleEntryForm, { type BottleInput } from "./BottleEntryForm";
type Welcome = {
  eventType: string;
  id: string;
  title: string;
  phase: string;
  revision: number;
  accepted: boolean;
  participantId: string | null;
  logoUrl?: string | null;
  ownBottle: BottleInput | null;
  winnerAward: string;
  swillAward: string;
  admin: boolean;
};
export default function EventWelcome({ id }: { id: string }) {
  const [data, setData] = useState<Welcome | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    setData(
      await request(`/api/events/${id}/enrollment`, { operation: "welcome" }),
    );
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") load().catch(() => {});
    }, 15000);
    return () => clearInterval(timer);
  }, [id]);
  async function run(f: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await f();
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="event-main">
      <p className="eyebrow">WELCOME TO YOUR EVENT</p>
      {data?.logoUrl && (
        <img
          className="series-logo"
          src={data.logoUrl}
          alt={`${data.title} logo`}
        />
      )}
      <h1>{data?.title ?? "Your invitation."}</h1>
      {error && (
        <p className="error" role="alert">
          {error} <a href="/">Sign in or check your approval status →</a>
        </p>
      )}
      {data && (
        <>
          <section className="panel">
            <h2>Bring a bottle. Keep the mystery.</h2>
            <p>
              Each participant brings one bottle and judges every flight.
              Everyone ranks the pours from favorite to least favorite,
              including their own anonymous bottle. Your bottle details stay
              hidden from the other tasters.
            </p>
            {data.eventType === "bourbon-tasting" && (
              <details>
                <summary>Bourbon Tasting rules</summary>
                <p>
                  Preference ranking contributes 80%; aroma, flavor, smoothness
                  and overall enjoyment each contribute 5%. Rank every cup once
                  and score each attribute from 1 to 10. Your host opens and
                  closes each flight, resolves blind ties, and controls the
                  reveal. After a flight closes, the host may share cup scores
                  and each taster’s ranks and scores. Bottle names and owners
                  stay hidden until the final reveal.
                </p>
                <p>
                  Depending on the size of the field, bottles advance through
                  opening flights and semifinals to the final. Finalists rank
                  ahead of bottles eliminated earlier. The winner earns{" "}
                  {data.winnerAward}; last place earns {data.swillAward}.
                </p>
                {data.accepted && (
                  <a href={`/event/${id}/rules`}>
                    Read the complete event rules →
                  </a>
                )}
              </details>
            )}
            {!data.accepted && !data.admin && (
              <button
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await request("/api/community", {
                      operation: "accept",
                      eventId: id,
                      participantId: data.participantId,
                    });
                    setNotice(
                      "Invitation accepted. Add the bottle you plan to bring.",
                    );
                  })
                }
              >
                Accept invitation & complete event profile
              </button>
            )}
          </section>
          {data.accepted && data.phase === "setup" && (
            <section className="panel">
              <p className="eyebrow">YOUR EVENT PROFILE</p>
              <h2>The bottle you plan to bring</h2>
              <p>
                Enter the bottle name, distillery and proof. You can update
                these before the host prepares the event. If your bottle changes
                at the last minute, ask the host to correct it before tasting
                begins.
              </p>
              <BottleEntryForm
                key={`${data.ownBottle?.name ?? ""}:${data.ownBottle?.proof ?? ""}`}
                initial={data.ownBottle}
                busy={busy}
                onSave={(values) =>
                  run(async () => {
                    await request(`/api/events/${id}`, {
                      type: "bottle-entry",
                      revision: data.revision,
                      ...values,
                    });
                    setNotice(
                      "Your bottle details are saved. The host will let you know when the event is ready.",
                    );
                  })
                }
              />
            </section>
          )}
          {data.accepted && data.phase !== "setup" && (
            <section className="panel">
              <h2>
                {data.phase === "complete"
                  ? "The event has finished."
                  : "The event is ready to begin."}
              </h2>
              <p>
                Your host will open the tasting flights. Follow the cup numbers
                on your screen.
              </p>
              <a className="button" href={`/event/${id}`}>
                Enter the tasting room →
              </a>
            </section>
          )}
          {data.accepted && data.phase === "setup" && data.ownBottle && (
            <p className="notice">
              Your event profile is complete. Waiting for the other participants
              and the host.
            </p>
          )}
        </>
      )}
      {notice && <p role="status">{notice}</p>}
      <p>
        <a href="/">← Home</a>
      </p>
    </main>
  );
}
