"use client";

import { useEffect, useState } from "react";
import Avatar from "@/app/components/Avatar";
import BlindcapLoading from "@/app/components/BlindcapLoading";
import LoadingLink from "@/app/components/LoadingLink";
import { request } from "@/lib/browser";

const labels = { active: "Approved", pending: "Pending approval", suspended: "Disabled" };
type Participant = {
  id: string;
  avatarUrl?: string | null;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  display_name: string;
  email: string;
  status: keyof typeof labels;
  created_at: string;
};

function participantName(person: Participant) {
  return [person.first_name, person.last_name].filter(Boolean).join(" ").trim()
    || person.full_name?.trim()
    || person.display_name;
}

export default function ParticipantDirectory() {
  const [participants, setParticipants] = useState<Participant[] | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("newest");

  useEffect(() => {
    let active = true;
    request("/api/community", { operation: "participant-directory" })
      .then((data) => { if (active) setParticipants(data.participants); })
      .catch((error) => { if (active) setError(error.message); });
    return () => { active = false; };
  }, []);

  const query = search.trim().toLowerCase();
  const rows = (participants ?? []).filter((person) =>
    (status === "all" || person.status === status) &&
    [participantName(person), person.display_name, person.email].some((value) =>
      value.toLowerCase().includes(query),
    ),
  ).sort((a, b) => {
    if (sort === "name") return participantName(a).localeCompare(participantName(b));
    return sort === "oldest"
      ? a.created_at.localeCompare(b.created_at)
      : b.created_at.localeCompare(a.created_at);
  });

  return (
    <main className="narrow">
      <div className="row-between">
        <h1>Participant directory</h1>
        <LoadingLink href="/">← Home</LoadingLink>
      </div>
      {error && <p role="alert" className="error">{error}</p>}
      {!participants && !error && <BlindcapLoading label="Loading participants…" />}
      {participants && (
        <section className="panel" aria-label="All participant profiles">
          <p>
            {participants.length} profiles · {participants.filter((person) => person.status === "active").length} approved · {participants.filter((person) => person.status === "pending").length} pending
          </p>
          <LoadingLink href="/members">Review pending signups →</LoadingLink>
          <div className="event-filters">
            <label>Search participants
              <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name or email" />
            </label>
            <label>Membership status
              <select value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="all">All statuses</option>
                {Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label>Sort by
              <select value={sort} onChange={(event) => setSort(event.target.value)}>
                <option value="newest">Signup date · Newest first</option>
                <option value="oldest">Signup date · Oldest first</option>
                <option value="name">Name · A to Z</option>
              </select>
            </label>
          </div>
          <p role="status">Showing {rows.length} of {participants.length} profiles</p>
          {rows.length > 0 ? (
            <div className="table-scroll">
              <table>
                <thead><tr><th scope="col">Profile photo</th><th scope="col">Participant</th><th scope="col">Status</th><th scope="col">Signup date</th></tr></thead>
                <tbody>
                  {rows.map((person) => (
                    <tr key={person.id}>
                      <td><span className="result-person"><Avatar name={participantName(person)} url={person.avatarUrl} /></span></td>
                      <th scope="row">{participantName(person)}<small className="flight-recap-identity">{person.email}</small></th>
                      <td>
                        {person.status === "pending"
                          ? <LoadingLink href={`/members?review=${encodeURIComponent(person.id)}#review-${encodeURIComponent(person.id)}`}>Pending approval</LoadingLink>
                          : labels[person.status]}
                      </td>
                      <td><time dateTime={person.created_at}>{new Date(person.created_at).toLocaleDateString()}</time></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p>No participants match your search and filters.</p>}
        </section>
      )}
    </main>
  );
}
