"use client";
import { useEffect, useState } from "react";
import { request } from "@/lib/browser";
import Avatar from "./Avatar";
type Member = {
  avatarUrl?: string | null;
  id: string;
  username: string;
  displayName: string;
  bio: string;
};
export default function MemberPicker({
  selected,
  unavailableIds = [],
  onSelect,
  onClear,
  clearLabel = "Use a guest seat instead",
  hint = "Choose a profile, or enter a guest’s details below.",
}: {
  unavailableIds?: readonly string[];
  selected?: { id: string; name: string };
  onSelect: (p: Member) => void;
  onClear: () => void;
  clearLabel?: string;
  hint?: string;
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
            {clearLabel}
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
              disabled={unavailableIds.includes(p.id)}
              onClick={() => {
                onSelect(p);
                setQuery("");
                setMembers([]);
              }}
            >
              <Avatar name={p.displayName} url={p.avatarUrl} />
              {p.displayName} <small>@{p.username}</small>
              {unavailableIds.includes(p.id) && " · Already added"}
            </button>
          ))}
          <small>{hint}</small>
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
