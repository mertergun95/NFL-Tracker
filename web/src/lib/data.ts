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
  engine?: string; // "ml" | "heuristic"
  target: { season: number; week: number };
  rows: StatRow[];
}

export async function loadProjections(): Promise<ProjectionsPayload | null> {
  try {
    const res = await fetch(`${BASE}/projections.json`);
    if (!res.ok) return null;
    const raw = await res.json() as {
      generated_at: string; data_season: number; engine?: string;
      target: { season: number; week: number };
      columns: string[]; rows: (string | number | null)[][];
    };
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

export type EvalStatMetrics = Record<string, {
  n: number; mae: number; bias: number; corr: number | null;
}>;

export interface ProjEvalPayload {
  generated_at: string;
  data_season: number;
  method: LocalizedText;
  weeks: { week: number; stats: EvalStatMetrics;
           methods?: Record<string, EvalStatMetrics> }[];
  players: StatRow[];
}

export async function loadProjEval(): Promise<ProjEvalPayload | null> {
  try {
    const res = await fetch(`${BASE}/proj_eval.json`);
    if (!res.ok) return null;
    return (await res.json()) as ProjEvalPayload;
  } catch {
    return null;
  }
}

/** Pipeline üretimi metinler: düz dize (eski) ya da {en,tr,de} sözlüğü. */
export type LocalizedText = string | Record<string, string>;

export interface Insight {
  title: LocalizedText;
  detail: LocalizedText;
  player_id?: string;
  team?: string;
  game?: string;
  value?: number;
  /** Yön: eskiden başlığa gömülü emoji (🔥/🧊) ile taşınıyordu; artık
   *  yapısal alan, arayüz kendi görsel işaretini seçiyor. */
  kind?: "up" | "down";
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

/* -------------------------------------------- güç sıralaması ve fikstür */

/** power.json / ncaa/power.json — satırlar StatRow olarak döner. */
export const loadPower = () => loadOptional("power.json");
export const loadSos = () => loadOptional("sos.json");

export interface PowerRow {
  off_rank: number | null;
  def_rank: number | null;
  off_rating: number | null;
  def_rating: number | null;
}

/** Takım -> güç sıralaması; tabloda rozet basmak için hızlı erişim. */
export function powerMap(rows: StatRow[] | null | undefined): Map<string, PowerRow> {
  const m = new Map<string, PowerRow>();
  for (const r of rows ?? []) {
    m.set(String(r.team), {
      off_rank: r.off_rank as number | null,
      def_rank: r.def_rank as number | null,
      off_rating: r.off_rating as number | null,
      def_rating: r.def_rating as number | null,
    });
  }
  return m;
}

/** (takım, pozisyon) -> o haftanın SOS değeri (0-10, yüksek = kolay). */
export function sosMap(rows: StatRow[] | null | undefined, week: number):
    Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows ?? []) {
    const v = r[`w${week}`];
    if (typeof v === "number") m.set(`${r.team}|${r.position}`, v);
  }
  return m;
}

/* ------------------------------------------------------------ NFL agent */

export interface AgentSignal {
  key: string;
  label: string;
  value: string;
  tone: "up" | "down" | "neutral";
}

export interface AgentPick {
  player_id: string;
  player_name: string;
  position: string;
  team: string;
  opponent: string;
  kind: "boom" | "bust";
  score: number;
  confidence: "high" | "medium" | "low";
  angle: string;
  note: string;
  written_by: "model" | "rules";
  proj_ppr: number | null;
  proj_floor_ppr: number | null;
  proj_ceiling_ppr: number | null;
  recent_games: { week: number; opponent: string | null; ppr: number | null }[];
  signals: AgentSignal[];
}

export interface AgentGraded {
  player_id: string;
  player_name: string;
  position: string;
  team: string;
  kind: "boom" | "bust";
  proj_ppr: number | null;
  actual_ppr?: number;
  bar?: number;
  hit?: boolean;
}

export interface AgentPayload {
  generated_at: string;
  data_season: number;
  through_week: number;
  target: { season: number; week: number };
  /** Anlatıyı yazan model, ya da API yoksa "rules". */
  engine: string;
  language: string;
  headline: string;
  overview: string;
  sections: { title: string; body: string }[];
  picks: AgentPick[];
  record: {
    weeks?: number;
    boom?: { hits: number; n: number; rate: number | null };
    bust?: { hits: number; n: number; rate: number | null };
  };
  history: { season: number; week: number; picks: AgentGraded[] }[];
}

export async function loadAgent(): Promise<AgentPayload | null> {
  try {
    const res = await fetch(`${BASE}/agent.json`);
    if (!res.ok) return null;
    return (await res.json()) as AgentPayload;
  } catch {
    return null;
  }
}

export function seasonsFromManifest(m: Manifest): number[] {
  return Object.keys(m.seasons)
    .map(Number)
    .sort((a, b) => b - a);
}
