/** NCAA veri erişimi — NFL tarafıyla aynı önbellek/yükleyici altyapısı,
 *  farklı yol öneki (`ncaa/`). Kolon kümesi ESPN box score'un sunduğuyla
 *  sınırlı, o yüzden ayrı presetler var. */
import { getJson, type LoadOptions } from "./cache";
import { loadColumnar, loadOptional, toRows } from "./data";
import type { Manifest, StatRow } from "./types";

export async function loadNcaaManifest(o?: LoadOptions): Promise<Manifest | null> {
  try {
    return await getJson<Manifest>("ncaa/manifest.json", o);
  } catch {
    return null;
  }
}

export const loadNcaaTeams = (o?: LoadOptions) => loadOptional("ncaa/teams.json", o);
export const loadNcaaPlayerIndex = (o?: LoadOptions) =>
  loadOptional("ncaa/players/index.json", o);
export const loadNcaaPlayerSeason = (s: number | string, o?: LoadOptions) =>
  loadColumnar(`ncaa/seasons/${s}/player_season.json`, o);
export const loadNcaaPlayerWeeks = (s: number | string, o?: LoadOptions) =>
  loadColumnar(`ncaa/seasons/${s}/player_weeks.json`, o);
export const loadNcaaTeamSeason = (s: number | string, o?: LoadOptions) =>
  loadColumnar(`ncaa/seasons/${s}/team_season.json`, o);
export const loadNcaaTeamWeeks = (s: number | string, o?: LoadOptions) =>
  loadColumnar(`ncaa/seasons/${s}/team_weeks.json`, o);
export const loadNcaaSchedule = (s: number | string, o?: LoadOptions) =>
  loadColumnar(`ncaa/seasons/${s}/schedule.json`, o);
export const loadNcaaRosters = (o?: LoadOptions) => loadOptional("ncaa/rosters.json", o);
export const loadNcaaNextSchedule = (o?: LoadOptions) =>
  loadOptional("ncaa/next_schedule.json", o);

export interface NcaaProjectionsPayload {
  generated_at: string;
  data_season: number;
  engine: string;
  target: { season: number; week: number };
  rows: StatRow[];
}

export async function loadNcaaProjections(o?: LoadOptions):
    Promise<NcaaProjectionsPayload | null> {
  try {
    const raw = await getJson<
      Omit<NcaaProjectionsPayload, "rows"> & {
        columns: string[]; rows: (string | number | null)[][];
      }
    >("ncaa/projections.json", o);
    return { ...raw, rows: toRows({ columns: raw.columns, rows: raw.rows }) };
  } catch {
    return null;
  }
}

export interface NcaaProjEvalPayload {
  generated_at: string;
  data_season: number;
  method: string;
  weeks: {
    week: number;
    stats: Record<string, { n: number; mae: number; bias: number; corr: number | null }>;
  }[];
  players: StatRow[];
}

export async function loadNcaaProjEval(o?: LoadOptions):
    Promise<NcaaProjEvalPayload | null> {
  try {
    return await getJson<NcaaProjEvalPayload>("ncaa/proj_eval.json", o);
  } catch {
    return null;
  }
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

export const NCAA_POSITIONS = ["QB", "RB", "WR"];

export function ncaaPreset(pos: string | null | undefined): string[] {
  return NCAA_PRESETS[String(pos)] ?? NCAA_PRESETS.WR;
}

export interface NcaaTeamInfo {
  school: string;
  name: string;
  conference: string | null;
}

/** abbr -> logo URL. teams.json her yerde yüklü olmadığı için (ör. rozet
 *  derin bir ekranda tek başına çiziliyor) harita modül seviyesinde
 *  tutuluyor; teamMapOf her çağrıldığında güncellenir. */
const LOGOS = new Map<string, string>();
export const ncaaLogoUrl = (abbr: string | null | undefined): string | null =>
  (abbr && LOGOS.get(abbr)) || null;

/** abbr -> takım kimliği haritası. */
export function teamMapOf(rows: StatRow[] | null): Map<string, NcaaTeamInfo> {
  const m = new Map<string, NcaaTeamInfo>();
  for (const r of rows ?? []) {
    const abbr = String(r.team);
    m.set(abbr, {
      school: String(r.school ?? r.team),
      name: String(r.name ?? r.team),
      conference: r.conference === null || r.conference === undefined
        ? null : String(r.conference),
    });
    if (r.logo) LOGOS.set(abbr, String(r.logo));
  }
  return m;
}

/** REG/POST'u tek sıraya çeviren kronolojik anahtar (bowl'lar en sonda). */
export const ncaaOrd = (r: StatRow): number =>
  Number(r.week) + (String(r.season_type) === "POST" ? 100 : 0);
