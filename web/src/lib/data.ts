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

export function seasonsFromManifest(m: Manifest): number[] {
  return Object.keys(m.seasons)
    .map(Number)
    .sort((a, b) => b - a);
}
