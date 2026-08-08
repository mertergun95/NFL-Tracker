/** Veri erişimi — web'deki lib/data.ts'in mobil karşılığı.
 *  Fark: fetch yerine önbellekli getJson() ve her yükleyicide "force"
 *  seçeneği (aşağı çekerek yenileme için). */
import { getJson, type LoadOptions } from "./cache";
import type {
  ColumnarData, InsightsPayload, Manifest, ProjectionsPayload, ProjEvalPayload,
  StatRow,
} from "./types";

const rowCache = new Map<string, StatRow[]>();

/** Kolonsal JSON'u satır nesnelerine çevirir. */
export function toRows(data: ColumnarData): StatRow[] {
  return data.rows.map((r) => {
    const obj: StatRow = {};
    data.columns.forEach((c, i) => (obj[c] = r[i]));
    return obj;
  });
}

export async function loadColumnar(path: string, o: LoadOptions = {}): Promise<StatRow[]> {
  if (!o.force && rowCache.has(path)) return rowCache.get(path)!;
  const rows = toRows(await getJson<ColumnarData>(path, o));
  rowCache.set(path, rows);
  return rows;
}

/** Opsiyonel veri seti: dosya yoksa null döner (404'te patlamaz). */
export async function loadOptional(path: string, o: LoadOptions = {}):
    Promise<StatRow[] | null> {
  try {
    return await loadColumnar(path, o);
  } catch {
    return null;
  }
}

export const loadManifest = (o?: LoadOptions) => getJson<Manifest>("manifest.json", o);

export const loadPlayerIndex = (o?: LoadOptions) => loadColumnar("players/index.json", o);
export const loadPlayerSeason = (season: number | string, o?: LoadOptions) =>
  loadColumnar(`seasons/${season}/player_season.json`, o);
export const loadPlayerWeeks = (season: number | string, o?: LoadOptions) =>
  loadColumnar(`seasons/${season}/player_weeks.json`, o);
export const loadTeamSeason = (season: number | string, o?: LoadOptions) =>
  loadColumnar(`seasons/${season}/team_season.json`, o);
export const loadTeamWeeks = (season: number | string, o?: LoadOptions) =>
  loadColumnar(`seasons/${season}/team_weeks.json`, o);
export const loadSchedule = (season: number | string, o?: LoadOptions) =>
  loadColumnar(`seasons/${season}/schedule.json`, o);

export const loadSnapCounts = (season: number | string, o?: LoadOptions) =>
  loadOptional(`seasons/${season}/snap_counts.json`, o);
export const loadRedzone = (season: number | string, o?: LoadOptions) =>
  loadOptional(`seasons/${season}/player_redzone.json`, o);
export const loadNgs = (
  season: number | string, kind: "passing" | "rushing" | "receiving", o?: LoadOptions,
) => loadOptional(`seasons/${season}/ngs_${kind}.json`, o);
export const loadTeamAdvanced = (season: number | string, o?: LoadOptions) =>
  loadOptional(`seasons/${season}/team_advanced.json`, o);

export const loadInjuries = (o?: LoadOptions) => loadOptional("injuries.json", o);
export const loadDepthCharts = (o?: LoadOptions) => loadOptional("depth_charts.json", o);
export const loadNextSchedule = (o?: LoadOptions) =>
  loadOptional("next_schedule.json", o);

export async function loadProjections(o?: LoadOptions): Promise<ProjectionsPayload | null> {
  try {
    const raw = await getJson<
      Omit<ProjectionsPayload, "rows"> & { columns: string[]; rows: (string | number | null)[][] }
    >("projections.json", o);
    return {
      generated_at: raw.generated_at,
      data_season: raw.data_season,
      engine: raw.engine,
      target: raw.target,
      rows: toRows({ columns: raw.columns, rows: raw.rows }),
    };
  } catch {
    return null;
  }
}

export async function loadInsights(o?: LoadOptions): Promise<InsightsPayload | null> {
  try {
    return await getJson<InsightsPayload>("insights.json", o);
  } catch {
    return null;
  }
}

export async function loadProjEval(o?: LoadOptions): Promise<ProjEvalPayload | null> {
  try {
    return await getJson<ProjEvalPayload>("proj_eval.json", o);
  } catch {
    return null;
  }
}

export function seasonsFromManifest(m: Manifest): number[] {
  return Object.keys(m.seasons).map(Number).sort((a, b) => b - a);
}
