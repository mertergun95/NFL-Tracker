// Pipeline'ın ürettiği kolonsal JSON biçimi
export interface ColumnarData {
  columns: string[];
  rows: (string | number | null)[][];
}

// Genel satır tipi: kolon adı -> değer
export type StatRow = Record<string, string | number | null>;

export interface Manifest {
  generated_at: string;
  seasons: Record<
    string,
    { last_reg_week: number; last_post_week: number; player_week_rows: number }
  >;
  sources: string[];
}

export interface PlayerIndexEntry {
  player_id: string;
  player_name: string;
  position: string | null;
  team: string | null;
  headshot_url: string | null;
  first_season: number;
  last_season: number;
  seasons: number[] | string;
}
