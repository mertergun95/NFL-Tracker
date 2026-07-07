// İstatistik kolonlarının kısa etiketleri ve pozisyona göre tablo ön ayarları

export const STAT_LABELS: Record<string, string> = {
  player_name: "Oyuncu",
  position: "Poz",
  team: "Takım",
  opponent_team: "Rakip",
  season: "Sezon",
  week: "Hafta",
  season_type: "Tip",
  games: "Maç",
  completions: "Cmp",
  attempts: "Att",
  passing_yards: "Pas Yds",
  passing_tds: "Pas TD",
  passing_interceptions: "Int",
  sacks_suffered: "Sack",
  passing_air_yards: "Air Yds",
  passing_yards_after_catch: "Pas YAC",
  passing_epa: "Pas EPA",
  carries: "Koşu",
  rushing_yards: "Koşu Yds",
  rushing_tds: "Koşu TD",
  rushing_fumbles: "Fum",
  rushing_fumbles_lost: "Fum Kayıp",
  rushing_epa: "Koşu EPA",
  receptions: "Rec",
  targets: "Tgt",
  receiving_yards: "Rec Yds",
  receiving_tds: "Rec TD",
  receiving_air_yards: "Rec Air",
  receiving_yards_after_catch: "YAC",
  target_share: "Tgt %",
  air_yards_share: "Air %",
  receiving_epa: "Rec EPA",
  fg_made: "FG",
  fg_att: "FG Att",
  fg_long: "FG Uzun",
  fg_pct: "FG %",
  pat_made: "XP",
  pat_att: "XP Att",
  def_tackles_solo: "Solo Tkl",
  def_tackle_assists: "Ast Tkl",
  def_tackles_with_assist: "Tkl+Ast",
  def_sacks: "Sack",
  def_interceptions: "Int",
  def_pass_defended: "PD",
  def_tds: "Def TD",
  def_fumbles_forced: "FF",
  def_fumble_recovery_opp: "FR",
  fantasy_points: "FPts",
  fantasy_points_ppr: "FPts PPR",
  wins: "G",
  losses: "M",
  ties: "B",
  points_for: "Atılan Sayı",
  points_against: "Yenilen Sayı",
};

export const label = (col: string) => STAT_LABELS[col] ?? col;

// Pozisyon grubuna göre gösterilecek istatistik kolonları
export const POSITION_PRESETS: Record<string, string[]> = {
  QB: [
    "completions", "attempts", "passing_yards", "passing_tds",
    "passing_interceptions", "sacks_suffered", "passing_epa",
    "carries", "rushing_yards", "rushing_tds", "fantasy_points_ppr",
  ],
  RB: [
    "carries", "rushing_yards", "rushing_tds", "rushing_fumbles_lost",
    "targets", "receptions", "receiving_yards", "receiving_tds",
    "target_share", "fantasy_points_ppr",
  ],
  WR: [
    "targets", "receptions", "receiving_yards", "receiving_tds",
    "receiving_yards_after_catch", "target_share", "air_yards_share",
    "receiving_epa", "carries", "rushing_yards", "fantasy_points_ppr",
  ],
  TE: [
    "targets", "receptions", "receiving_yards", "receiving_tds",
    "receiving_yards_after_catch", "target_share", "receiving_epa",
    "fantasy_points_ppr",
  ],
  K: ["fg_made", "fg_att", "fg_pct", "fg_long", "pat_made", "pat_att", "fantasy_points"],
  DEF: [
    "def_tackles_solo", "def_tackle_assists", "def_sacks",
    "def_interceptions", "def_pass_defended", "def_tds", "def_fumbles_forced",
  ],
};

export function presetForPosition(pos: string | null): string[] {
  if (!pos) return POSITION_PRESETS.WR;
  if (pos in POSITION_PRESETS) return POSITION_PRESETS[pos];
  if (["FB"].includes(pos)) return POSITION_PRESETS.RB;
  if (["P"].includes(pos)) return POSITION_PRESETS.K;
  return POSITION_PRESETS.DEF;
}

export function fmt(col: string, v: string | number | null): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "number") {
    if (col === "target_share" || col === "air_yards_share")
      return `${(v * 100).toFixed(1)}%`;
    if (Number.isInteger(v)) return String(v);
    return v.toFixed(1);
  }
  return String(v);
}
