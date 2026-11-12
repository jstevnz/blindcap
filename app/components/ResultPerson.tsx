import Avatar from "./Avatar";

export default function ResultPerson({ name, avatarUrl }: { name: string; avatarUrl?: string | null }) {
  return (
    <span className="result-person">
      <Avatar name={name} url={avatarUrl} />
      <span>{name}</span>
    </span>
  );
}
