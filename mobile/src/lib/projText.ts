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

/** Pozisyona göre projeksiyonu üretilen GERÇEK statlar (proj_ öneki olmadan).
    Her birinin kendi taban (proj_floor_) / tavan (proj_ceiling_) aralığı var. */
export const POS_PROJ_STATS: Record<string, string[]> = {
  QB: ["attempts", "completions", "passing_yards", "passing_tds",
       "passing_interceptions", "carries", "rushing_yards"],
  RB: ["carries", "rushing_yards", "rushing_tds", "targets", "receptions",
       "receiving_yards"],
  WR: ["targets", "receptions", "receiving_yards", "receiving_tds"],
  TE: ["targets", "receptions", "receiving_yards", "receiving_tds"],
  FB: ["carries", "rushing_yards", "rushing_tds", "targets", "receptions",
       "receiving_yards"],
};

/** Bir satırdaki tüm proj_ statları (pozisyon listesi + fantasy puanı),
    yalnızca değeri olanlar. */
export function projStatsOf(row: StatRow): string[] {
  const base = POS_PROJ_STATS[String(row.position)] ?? POS_PROJ_STATS.WR;
  const has = (s: string) => {
    const v = row[`proj_${s}`];
    return v !== null && v !== undefined;
  };
  return [...base, "ppr"].filter(has);
}

/** Bir statın taban–tavan aralığı (yoksa null). */
export function rangeOf(row: StatRow, stat: string):
    [number, number] | null {
  const lo = row[`proj_floor_${stat}`], hi = row[`proj_ceiling_${stat}`];
  if (lo === null || lo === undefined || hi === null || hi === undefined)
    return null;
  return [Number(lo), Number(hi)];
}
