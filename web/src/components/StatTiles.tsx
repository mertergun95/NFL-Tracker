import type { StatRow } from "../lib/types";
import { fmt, label } from "../lib/columns";
import { useT } from "../lib/i18n";

interface Props {
  row: StatRow;
  cols: string[];
  /** Lig ortalamaları (opsiyonel, küçük alt satır olarak gösterilir) */
  avg?: Record<string, number>;
}

/** Tek satırlık istatistikleri kutucuk ızgarası olarak gösterir. */
export default function StatTiles({ row, cols, avg }: Props) {
  const t = useT();
  const present = cols.filter((c) => row[c] !== null && row[c] !== undefined);
  if (present.length === 0) return null;
  return (
    <div className="tile-grid">
      {present.map((c) => (
        <div className="tile" key={c}>
          <div className="tile-label">{label(c)}</div>
          <div className="tile-value">{fmt(c, row[c])}</div>
          {avg && avg[c] !== undefined && (
            <div className="tile-avg">{t("chart.leagueAvgShort")} {fmt(c, avg[c])}</div>
          )}
        </div>
      ))}
    </div>
  );
}

/** Sayısal kolonların lig ortalamalarını hesaplar. */
export function leagueAverages(rows: StatRow[], cols: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of cols) {
    const vals = rows.map((r) => r[c]).filter((v): v is number => typeof v === "number");
    if (vals.length) out[c] = vals.reduce((s, v) => s + v, 0) / vals.length;
  }
  return out;
}
