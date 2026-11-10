"use client";
import { use, useEffect, useState } from "react";
import { request } from "@/lib/browser";
import type { Snapshot } from "@/lib/engine";
import BourbonRules from "./BourbonRules";
export default function EventRules({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params),
    [event, setEvent] = useState<Snapshot | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setEvent(null);
    setError("");
    request(`/api/events/${id}`)
      .then((data) => {
        if (active) setEvent(data);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [id]);
  if (error)
    return (
      <main className="narrow">
        <h1>Join your event first.</h1>
        <p>Sign in and accept your invitation to read this event’s rules.</p>
        <p role="alert">{error}</p>
        <a href="/">Go to Blindcap →</a>
      </main>
    );
  if (!event)
    return (
      <main className="narrow">
        <p>Checking your event invitation…</p>
      </main>
    );
  if (event.eventType !== "bourbon-tasting")
    return (
      <main className="narrow">
        <h1>Rules are not available for this event type.</h1>
        <a href={`/event/${id}`}>← Back to event</a>
      </main>
    );
  return (
    <BourbonRules
      eventId={id}
      title={event.title}
      winnerAward={event.series?.winnerAward ?? "Yorktown Tumbler"}
      swillAward={event.series?.swillAward ?? "Swill Award"}
    />
  );
}
