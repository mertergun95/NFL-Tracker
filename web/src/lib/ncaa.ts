import { loadColumnar, loadOptional } from "./data";
import type { Manifest, StatRow } from "./types";

const BASE = `${import.meta.env.BASE_URL}data/ncaa`;

export async function loadNcaaManifest(): Promise<Manifest | null> {
  try {
    const res = await fetch(`${BASE}/manifest.json`);
    if (!res.ok) return null;
    return (await res.json()) as Manifest;
  } catch {
    return null;
  }
}

export const loadNcaaTeams = () => loadOptional("ncaa/teams.json");
export const loadNcaaPlayerIndex = () => loadOptional("ncaa/players/index.json");
export const loadNcaaPlayerSeason = (s: number | string) =>
  loadColumnar(`ncaa/seasons/${s}/player_season.json`);
export const loadNcaaPlayerWeeks = (s: number | string) =>
  loadColumnar(`ncaa/seasons/${s}/player_weeks.json`);
export const loadNcaaTeamSeason = (s: number | string) =>
  loadColumnar(`ncaa/seasons/${s}/team_season.json`);
export const loadNcaaTeamWeeks = (s: number | string) =>
  loadColumnar(`ncaa/seasons/${s}/team_weeks.json`);
export const loadNcaaSchedule = (s: number | string) =>
  loadColumnar(`ncaa/seasons/${s}/schedule.json`);

export const loadNcaaRosters = () => loadOptional("ncaa/rosters.json");
export const loadNcaaNextSchedule = () => loadOptional("ncaa/next_schedule.json");

export interface NcaaProjectionsPayload {
  generated_at: string;
  data_season: number;
  engine: string;
  target: { season: number; week: number };
  rows: StatRow[];
}

export async function loadNcaaProjections(): Promise<NcaaProjectionsPayload | null> {
  try {
    const res = await fetch(`${BASE}/projections.json`);
    if (!res.ok) return null;
    const raw = await res.json() as {
      generated_at: string; data_season: number; engine: string;
      target: { season: number; week: number };
      columns: string[]; rows: (string | number | null)[][];
    };
    return {
      ...raw,
      rows: raw.rows.map((r) => {
        const o: StatRow = {};
        raw.columns.forEach((c, i) => (o[c] = r[i]));
        return o;
      }),
    };
  } catch {
    return null;
  }
}

export type NcaaEvalStatMetrics = Record<string, {
  n: number; mae: number; bias: number; corr: number | null;
}>;

export interface NcaaProjEvalPayload {
  generated_at: string;
  data_season: number;
  method: string;
  weeks: { week: number; stats: NcaaEvalStatMetrics }[];
  players: StatRow[];
}

export async function loadNcaaProjEval(): Promise<NcaaProjEvalPayload | null> {
  try {
    const res = await fetch(`${BASE}/proj_eval.json`);
    if (!res.ok) return null;
    return (await res.json()) as NcaaProjEvalPayload;
  } catch {
    return null;
  }
}

/** Pozisyona göre kompakt tahmin/gerçek satırı (prefix: "proj" | "act"). */
export function ncaaProjLine(p: StatRow, prefix: string): string {
  const v = (c: string) => {
    const val = p[`${prefix}_${c}`];
    return val !== null && val !== undefined ? String(val) : "—";
  };
  const pos = String(p.position);
  if (pos === "QB")
    return `${v("completions")}/${v("attempts")} · ${v("passing_yards")} yd · ` +
           `${v("passing_tds")} TD · ${v("passing_interceptions")} int`;
  if (pos === "RB")
    return `${v("carries")} koşu · ${v("rushing_yards")} yd · ` +
           `${v("receptions")} rec · ${v("receiving_yards")} rec yd`;
  return `${v("receptions")} rec · ${v("receiving_yards")} yd · ` +
         `${v("receiving_tds")} TD`;
}

export const NCAA_PRIMARY: Record<string, string> = {
  QB: "passing_yards", RB: "rushing_yards",
  WR: "receiving_yards", TE: "receiving_yards",
};

/** ESPN box score'un sunduğu statlarla sınırlı NCAA presetleri. */
export const NCAA_PRESETS: Record<string, string[]> = {
  QB: ["completions", "attempts", "passing_yards", "passing_tds",
       "passing_interceptions", "carries", "rushing_yards", "rushing_tds"],
  RB: ["carries", "rushing_yards", "rushing_tds",
       "receptions", "receiving_yards", "receiving_tds"],
  WR: ["receptions", "receiving_yards", "receiving_tds",
       "carries", "rushing_yards", "rushing_tds"],
};

export function ncaaPreset(pos: string | null | undefined): string[] {
  return NCAA_PRESETS[String(pos)] ?? NCAA_PRESETS.WR;
}

export interface NcaaTeamInfo {
  school: string;
  name: string;
  logo: string;
  conference: string | null;
}

/** abbr -> takım kimliği haritası. */
export function teamMapOf(rows: StatRow[] | null): Map<string, NcaaTeamInfo> {
  const m = new Map<string, NcaaTeamInfo>();
  for (const r of rows ?? []) {
    m.set(String(r.team), {
      school: String(r.school ?? r.team),
      name: String(r.name ?? r.team),
      logo: String(r.logo ?? ""),
      conference: r.conference === null ? null : String(r.conference),
    });
  }
  return m;
}
