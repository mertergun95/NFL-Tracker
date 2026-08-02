const STATUS_STYLE: Record<string, { bg: string; fg: string }> = {
  out: { bg: "var(--bad-bg)", fg: "var(--bad)" },
  doubtful: { bg: "var(--bad-bg)", fg: "var(--neutral-warm)" },
  questionable: { bg: "var(--bg-raised)", fg: "var(--warn)" },
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
      {String(status)}{note ? ` · ${note}` : ""}
    </span>
  );
}
