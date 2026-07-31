import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { StatRow } from "../lib/types";
import { fmt, label } from "../lib/columns";
import { translate } from "../lib/i18n";

interface Props {
  rows: StatRow[];
  columns: string[];
  defaultSort?: string;
  /** Kolon adı -> özel hücre render'ı (ör. oyuncu linki) */
  render?: Record<string, (row: StatRow) => ReactNode>;
  maxRows?: number;
}

export default function StatTable({ rows, columns, defaultSort, render, maxRows }: Props) {
  const [sortCol, setSortCol] = useState(defaultSort ?? columns[0]);
  const [desc, setDesc] = useState(true);

  // Çağıran taraf varsayılan sıralamayı değiştirdiğinde (ör. pozisyon sekmesi)
  // tablo eski kolonda takılı kalmasın.
  useEffect(() => {
    if (!defaultSort) return;
    setSortCol(defaultSort);
    setDesc(true);
  }, [defaultSort]);

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = a[sortCol], bv = b[sortCol];
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      if (typeof av === "number" && typeof bv === "number")
        return desc ? bv - av : av - bv;
      return desc
        ? String(bv).localeCompare(String(av))
        : String(av).localeCompare(String(bv));
    });
    return maxRows ? copy.slice(0, maxRows) : copy;
  }, [rows, sortCol, desc, maxRows]);

  const onSort = (c: string) => {
    if (c === sortCol) setDesc(!desc);
    else { setSortCol(c); setDesc(true); }
  };

  return (
    <div className="table-wrap">
      <table className="stat-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c} onClick={() => onSort(c)}
                  className={c === sortCol ? "sorted" : ""}>
                {label(c)}
                {c === sortCol ? (desc ? " ▾" : " ▴") : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr key={i}>
              {columns.map((c) => (
                <td key={c} className={typeof row[c] === "number" ? "num" : ""}>
                  {render?.[c] ? render[c](row) : fmt(c, row[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {sorted.length === 0 && <p className="empty">{translate("table.empty")}</p>}
    </div>
  );
}
