const STATUS_STYLE: Record<string, { bg: string; fg: string }> = {
  out: { bg: "#3d1216", fg: "#f85149" },
  doubtful: { bg: "#3d1f12", fg: "#f0883e" },
  questionable: { bg: "#3a2d12", fg: "#d4a72c" },
};

/** Sakatlık durumu rozeti (Out / Doubtful / Questionable). */
export default function StatusBadge({ status, note }:
  { status: string | null | undefined; note?: string | null }) {
  if (!status) return null;
  const s = STATUS_STYLE[String(status).toLowerCase()]
    ?? { bg: "var(--border)", fg: "var(--text-dim)" };
  return (
    <span className="status-badge" title={note ?? undefined}
          style={{ background: s.bg, color: s.fg }}>
      🩹 {String(status)}{note ? ` · ${note}` : ""}
    </span>
  );
}
