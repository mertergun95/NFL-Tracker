import type { StatRow } from "./types";

/** Pozisyona göre projeksiyon/gerçekleşen kompakt stat satırı.
    prefix: "proj" | "act" | "" (ham stat kolonları) */
export function projLine(p: StatRow, prefix: string): string {
  const v = (c: string) => {
    const val = p[prefix ? `${prefix}_${c}` : c];
    return val !== null && val !== undefined ? String(val) : "—";
  };
  const pos = String(p.position);
  if (pos === "QB")
    return `${v("completions")}/${v("attempts")} · ${v("passing_yards")} yd · ` +
           `${v("passing_tds")} TD · ${v("passing_interceptions")} int`;
  if (pos === "RB")
    return `${v("carries")} koşu · ${v("rushing_yards")} yd · ` +
           `${v("receptions")} rec · ${v("receiving_yards")} rec yd`;
  return `${v("targets")} tgt · ${v("receptions")} rec · ` +
         `${v("receiving_yards")} yd · ${v("receiving_tds")} TD`;
}

/** Pozisyonun birincil stat kolonu (isabet yüzdesi hesapları için). */
export const PRIMARY_STAT: Record<string, string> = {
  QB: "passing_yards", RB: "rushing_yards",
  WR: "receiving_yards", TE: "receiving_yards",
};
