import type { ColumnarData, Manifest, StatRow } from "./types";

const BASE = `${import.meta.env.BASE_URL}data`;
const cache = new Map<string, unknown>();

async function fetchJson<T>(path: string): Promise<T> {
  if (cache.has(path)) return cache.get(path) as T;
  const res = await fetch(`${BASE}/${path}`);
  if (!res.ok) throw new Error(`Veri yüklenemedi: ${path} (HTTP ${res.status})`);
  const json = (await res.json()) as T;
  cache.set(path, json);
  return json;
}

/** Kolonsal JSON'u satır nesnelerine çevirir. */
export function toRows(data: ColumnarData): StatRow[] {
  return data.rows.map((r) => {
    const obj: StatRow = {};
    data.columns.forEach((c, i) => (obj[c] = r[i]));
    return obj;
  });
}

export const loadManifest = () => fetchJson<Manifest>("manifest.json");

export async function loadColumnar(path: string): Promise<StatRow[]> {
  const key = `rows:${path}`;
  if (cache.has(key)) return cache.get(key) as StatRow[];
  const rows = toRows(await fetchJson<ColumnarData>(path));
  cache.set(key, rows);
  return rows;
}

export const loadPlayerIndex = () => loadColumnar("players/index.json");
export const loadPlayerSeason = (season: number | string) =>
  loadColumnar(`seasons/${season}/player_season.json`);
export const loadPlayerWeeks = (season: number | string) =>
  loadColumnar(`seasons/${season}/player_weeks.json`);
export const loadTeamSeason = (season: number | string) =>
  loadColumnar(`seasons/${season}/team_season.json`);
export const loadTeamWeeks = (season: number | string) =>
  loadColumnar(`seasons/${season}/team_weeks.json`);
export const loadSchedule = (season: number | string) =>
  loadColumnar(`seasons/${season}/schedule.json`);

/** Opsiyonel veri seti: dosya yoksa null döner (404'te patlamaz). */
export async function loadOptional(path: string): Promise<StatRow[] | null> {
  try {
    return await loadColumnar(path);
  } catch {
    return null;
  }
}

export const loadSnapCounts = (season: number | string) =>
  loadOptional(`seasons/${season}/snap_counts.json`);
export const loadRedzone = (season: number | string) =>
  loadOptional(`seasons/${season}/player_redzone.json`);
export const loadNgs = (season: number | string, t: "passing" | "rushing" | "receiving") =>
  loadOptional(`seasons/${season}/ngs_${t}.json`);
export const loadTeamAdvanced = (season: number | string) =>
  loadOptional(`seasons/${season}/team_advanced.json`);
export const loadTeamScheme = (season: number | string) =>
  loadOptional(`seasons/${season}/team_scheme.json`);

export const loadPlayerScheme = (season: number | string) =>
  loadOptional(`seasons/${season}/player_scheme.json`);
export const loadInjuries = () => loadOptional("injuries.json");

export interface ProjectionsPayload {
  generated_at: string;
  data_season: number;
  target: { season: number; week: number };
  rows: StatRow[];
}

export async function loadProjections(): Promise<ProjectionsPayload | null> {
  try {
    const res = await fetch(`${BASE}/projections.json`);
    if (!res.ok) return null;
    const raw = await res.json() as {
      generated_at: string; data_season: number;
      target: { season: number; week: number };
      columns: string[]; rows: (string | number | null)[][];
    };
    return {
      generated_at: raw.generated_at,
      data_season: raw.data_season,
      target: raw.target,
      rows: toRows({ columns: raw.columns, rows: raw.rows }),
    };
  } catch {
    return null;
  }
}

export interface Insight {
  title: string;
  detail: string;
  player_id?: string;
  team?: string;
  game?: string;
  value?: number;
}

export interface InsightsPayload {
  generated_at: string;
  data_season: number;
  through_week: number;
  next_game_week: { season: number; week: number };
  sections: Record<string, Insight[]>;
}

export async function loadInsights(): Promise<InsightsPayload | null> {
  try {
    const res = await fetch(`${BASE}/insights.json`);
    if (!res.ok) return null;
    return (await res.json()) as InsightsPayload;
  } catch {
    return null;
  }
}

export function seasonsFromManifest(m: Manifest): number[] {
  return Object.keys(m.seasons)
    .map(Number)
    .sort((a, b) => b - a);
}
