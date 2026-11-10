"use client";
export default function Avatar({
  name,
  url,
}: {
  name: string;
  url?: string | null;
}) {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "?";
  return url ? (
    <img className="profile-avatar" src={url} alt={`${name}'s profile photo`} />
  ) : (
    <span className="profile-avatar initials" aria-label={`${name}'s initials`}>
      {initials}
    </span>
  );
}
