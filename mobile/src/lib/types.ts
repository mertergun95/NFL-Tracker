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
