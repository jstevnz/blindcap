"use client";
import { useEffect, useState } from "react";
import { request } from "@/lib/browser";
type Member = {
  id: string;
  username: string;
  displayName: string;
  bio: string;
};
export default function MemberPicker({
  selected,
  onSelect,
  onClear,
}: {
  selected?: { id: string; name: string };
  onSelect: (p: Member) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState(""),
    [members, setMembers] = useState<Member[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    if (query.trim().length < 2) {
      setMembers([]);
      return;
    }
    let active = true;
    const timer = setTimeout(
      () =>
        request("/api/community", { operation: "search", query })
          .then((d) => {
            if (active) {
              setMembers(d.profiles);
              setError("");
            }
          })
          .catch((e) => {
            if (active) setError(e.message);
          }),
      300,
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);
  return (
    <div className="member-search">
      {selected ? (
        <>
          <p>
            Community member: <strong>{selected.name}</strong>
          </p>
          <button type="button" className="text-button" onClick={onClear}>
            Use a guest seat instead
          </button>
        </>
      ) : (
        <>
          <label>
            Find a community member
            <input
              value={query}
              maxLength={80}
              placeholder="Username or display name"
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          {members.map((p) => (
            <button
              type="button"
              className="secondary search-result"
              key={p.id}
              onClick={() => {
                onSelect(p);
                setQuery("");
                setMembers([]);
              }}
            >
              {p.displayName} <small>@{p.username}</small>
            </button>
          ))}
          <small>Choose a profile, or enter a guest’s details below.</small>
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
