/** WoA panellerinin ortak parçaları. Site genelindeki `rank-chip`, `pill`
 *  gibi sınıflar yeniden kullanılır; yalnız WoA'ya özgü olanlar woa.css'te. */
import type { ReactNode } from "react";
import TeamLogo from "../../components/TeamLogo";
import { fmt, label } from "../../lib/columns";
import { teamName } from "../../lib/teams";
import type { StatRow } from "../../lib/types";
import { rankIn, rowFor } from "../core/data";

export function RankChip({ rank }: { rank: number }) {
  if (!rank) return <span className="rank-chip">—</span>;
  const cls = rank <= 8 ? "good" : rank >= 25 ? "bad" : "";
  return <span className={`rank-chip ${cls}`}>#{rank}</span>;
}

export function TeamTag({ abbr, size = 20 }: { abbr: string; size?: number }) {
  return (
    <span className="woa-team">
      <TeamLogo abbr={abbr} size={size} /> {teamName(abbr)}
    </span>
  );
}

/** İki takımın aynı metriklerdeki değerleri, yanlarında lig sırası. */
export function Duel({ rows, all, away, home }: {
  rows: [string, boolean][];
  all: StatRow[] | null;
  away: string;
  home: string;
}) {
  const a = rowFor(all, away), h = rowFor(all, home);
  if (!a && !h) return <Empty />;
  return (
    <table className="woa-duel">
      <thead>
        <tr>
          <th />
          <th><TeamLogo abbr={away} size={18} /> {away}</th>
          <th><TeamLogo abbr={home} size={18} /> {home}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([col, highGood]) => (
          <tr key={col}>
            <th scope="row">{label(col)}</th>
            <td>{fmt(col, a?.[col] ?? null)}{" "}
              <RankChip rank={rankIn(all, away, col, highGood)} /></td>
            <td>{fmt(col, h?.[col] ?? null)}{" "}
              <RankChip rank={rankIn(all, home, col, highGood)} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Çapraz eşleşme: bir takımın hücumu, karşısındaki savunmaya bakışta. */
export function CrossDuel({ pairs, all, offense, defense }: {
  pairs: [string, string, boolean][]; // [hücum kolonu, savunma kolonu, hücum için yüksek iyi mi]
  all: StatRow[] | null;
  offense: string;
  defense: string;
}) {
  const o = rowFor(all, offense), d = rowFor(all, defense);
  if (!o && !d) return <Empty />;
  return (
    <table className="woa-duel woa-duel--cross">
      <thead>
        <tr>
          <th />
          <th><TeamLogo abbr={offense} size={18} /> {offense} <span className="woa-dim">OFF</span></th>
          <th><TeamLogo abbr={defense} size={18} /> {defense} <span className="woa-dim">DEF</span></th>
        </tr>
      </thead>
      <tbody>
        {pairs.map(([offCol, defCol, highGood]) => (
          <tr key={offCol}>
            <th scope="row">{label(offCol).replace(/^Off\s?/i, "").replace(/^Hücum\s?/i, "")}</th>
            <td>{fmt(offCol, o?.[offCol] ?? null)}{" "}
              <RankChip rank={rankIn(all, offense, offCol, highGood)} /></td>
            <td>{fmt(defCol, d?.[defCol] ?? null)}{" "}
              <RankChip rank={rankIn(all, defense, defCol, !highGood)} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Facts({ items }: { items: [string, ReactNode][] }) {
  return (
    <ul className="woa-facts">
      {items.map(([k, v]) => (
        <li key={k}><span className="woa-dim">{k}</span><strong>{v}</strong></li>
      ))}
    </ul>
  );
}

export function Hint({ children }: { children: ReactNode }) {
  return <p className="woa-hint">{children}</p>;
}

export function Empty() {
  return <p className="woa-empty">—</p>;
}

export function PanelBox({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="woa-panelbox">
      {title && <h4>{title}</h4>}
      {children}
    </div>
  );
}
