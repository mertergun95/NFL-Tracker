// Pipeline'ın ürettiği kolonsal JSON biçimi (web ile aynı sözleşme).
export interface ColumnarData {
  columns: string[];
  rows: (string | number | null)[][];
}

/** Genel satır tipi: kolon adı -> değer */
export type StatRow = Record<string, string | number | null>;

export interface Manifest {
  generated_at: string;
  seasons: Record<
    string,
    { last_reg_week: number; last_post_week: number; player_week_rows: number }
  >;
  sources?: string[];
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
  kind?: "up" | "down";
}

export interface InsightsPayload {
  generated_at: string;
  data_season: number;
  through_week: number;
  next_game_week: { season: number; week: number };
  sections: Record<string, Insight[]>;
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
  /** Anlatıyı yazan model, ya da API anahtarı yoksa "rules". */
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

export interface ProjectionsPayload {
  generated_at: string;
  data_season: number;
  engine?: "ml" | "heuristic" | string;
  target: { season: number; week: number };
  rows: StatRow[];
}

export type EvalStatMetrics = Record<
  string,
  { n: number; mae: number; bias: number; corr: number | null }
>;

export interface ProjEvalPayload {
  generated_at: string;
  data_season: number;
  method: LocalizedText;
  weeks: {
    week: number;
    stats: EvalStatMetrics;
    methods?: Record<string, EvalStatMetrics>;
  }[];
  players: StatRow[];
}
