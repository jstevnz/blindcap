export default function BlindcapLoading({
  label = "Loading BlindCap…",
  compact = false,
}: {
  label?: string;
  compact?: boolean;
}) {
  return (
    <span className={compact ? "blindcap-loading blindcap-loading-compact" : "blindcap-loading"} role="status">
      <img src="/brand/blindcap-b.png" width={48} height={48} alt="" />
      <span className="blindcap-loading-dots" aria-hidden="true">
        <span /><span /><span />
      </span>
      <span className="blindcap-loading-label">{label}</span>
    </span>
  );
}
