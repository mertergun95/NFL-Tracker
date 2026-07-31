import { fmt, fmtRange, label } from "../lib/columns";
import { projStatsOf, rangeOf } from "../lib/projText";
import type { StatRow } from "../lib/types";
import { useT } from "../lib/i18n";

/** Projeksiyonun HER statı için: değer + kendi taban–tavan aralığı.
    (Tek bir "birincil" stat ya da yalnızca fantasy puanı değil.) */
export default function ProjRanges({ row }: { row: StatRow }) {
  const t = useT();
  const stats = projStatsOf(row);
  if (stats.length === 0) return null;
  return (
    <div className="proj-range-grid">
      {stats.map((s) => {
        const col = `proj_${s}`;
        const band = rangeOf(row, s);
        return (
          <div className="proj-range-item" key={s}>
            <div className="proj-range-label">
              {s === "ppr" ? label("proj_ppr") : label(s)}
            </div>
            <div className="proj-range-value">{fmt(col, row[col] as number)}</div>
            <div className="proj-range-band"
                 title={band ? t("proj.rangeTitle") : undefined}>
              {band ? fmtRange(col, band[0], band[1]) : "—"}
            </div>
          </div>
        );
      })}
    </div>
  );
}
