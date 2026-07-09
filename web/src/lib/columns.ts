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
  // paylar
  carry_share: "Koşu %",
  target_share_calc: "Tgt %",
  rush_yds_share: "Koşu Yds %",
  rec_yds_share: "Rec Yds %",
  // red zone
  rz_carries: "RZ Koşu",
  rz_rush_tds: "RZ Koşu TD",
  rz_targets: "RZ Tgt",
  rz_receptions: "RZ Rec",
  rz_rec_tds: "RZ Rec TD",
  rz_pass_att: "RZ Pas Att",
  rz_pass_tds: "RZ Pas TD",
  rz_pass_ints: "RZ Int",
  i10_carries: "İç-10 Koşu",
  i10_rush_tds: "İç-10 Koşu TD",
  i10_targets: "İç-10 Tgt",
  i10_receptions: "İç-10 Rec",
  i10_rec_tds: "İç-10 Rec TD",
  i10_pass_att: "İç-10 Pas Att",
  i10_pass_tds: "İç-10 Pas TD",
  i10_pass_ints: "İç-10 Int",
  // snap counts
  offense_snaps: "Hücum Snap",
  offense_pct: "Hücum Snap %",
  defense_snaps: "Sav. Snap",
  defense_pct: "Sav. Snap %",
  st_snaps: "ST Snap",
  st_pct: "ST Snap %",
  opponent: "Rakip",
  game_type: "Tip",
  player: "Oyuncu",
  // NGS passing
  avg_time_to_throw: "Atış Süresi (sn)",
  avg_intended_air_yards: "Hedef Air Yds",
  avg_completed_air_yards: "Tamam. Air Yds",
  avg_air_yards_differential: "Air Yds Farkı",
  aggressiveness: "Agresiflik %",
  avg_air_yards_to_sticks: "Sticks'e Air Yds",
  max_completed_air_distance: "Maks Hava Mesafesi",
  passer_rating: "Rating",
  completion_percentage: "Cmp %",
  expected_completion_percentage: "xCmp %",
  completion_percentage_above_expectation: "CPOE",
  pass_yards: "Pas Yds",
  pass_touchdowns: "Pas TD",
  interceptions: "Int",
  // NGS rushing
  rush_attempts: "Koşu",
  rush_yards: "Koşu Yds",
  rush_touchdowns: "Koşu TD",
  efficiency: "Verimlilik",
  percent_attempts_gte_eight_defenders: "8+ Box %",
  avg_time_to_los: "LOS Süresi (sn)",
  expected_rush_yards: "xKoşu Yds",
  rush_yards_over_expected: "RYOE",
  rush_yards_over_expected_per_att: "RYOE/Att",
  rush_pct_over_expected: "ROE %",
  // NGS receiving
  yards: "Yds",
  rec_touchdowns: "Rec TD",
  catch_percentage: "Catch %",
  avg_cushion: "Cushion",
  avg_separation: "Ayrışma",
  percent_share_of_intended_air_yards: "Air Yds Pay %",
  avg_yac: "Ort YAC",
  avg_expected_yac: "xYAC",
  avg_yac_above_expectation: "YAC+",
  // takım advanced
  off_plays: "Hücum Play",
  off_epa_play: "Hücum EPA/Play",
  off_success_rate: "Hücum Success %",
  off_pass_rate: "Pas Oranı",
  off_pass_epa: "Pas EPA/Play",
  off_rush_epa: "Koşu EPA/Play",
  off_sack_rate: "Yenen Sack %",
  off_explosive_rate: "Explosive %",
  off_third_down_conv: "3. Down %",
  off_rz_td_pct: "RZ TD %",
  off_turnovers: "Top Kaybı",
  def_plays: "Sav. Play",
  def_epa_play: "Sav. EPA/Play",
  def_success_rate: "Sav. Success %",
  def_pass_rate: "Rakip Pas Oranı",
  def_pass_epa: "Pas EPA (verilen)",
  def_rush_epa: "Koşu EPA (verilen)",
  def_sack_rate: "Sack %",
  def_explosive_rate: "Explosive % (verilen)",
  def_third_down_conv: "3. Down % (verilen)",
  def_rz_td_pct: "RZ TD % (verilen)",
  def_turnovers: "Top Çalma",
  // oyuncu şema splitleri
  split_play_action: "Play Action",
  split_no_play_action: "PA'sız",
  split_vs_blitz: "Blitze Karşı",
  split_no_blitz: "Blitzsiz",
  split_shotgun: "Shotgun",
  split_under_center: "Under Center",
  split_heavy_box: "8+ Box",
  split_light_box: "Hafif Box",
  split_screen: "Screen",
  split: "Bağlam",
  plays: "Play",
  tds: "TD",
  ints: "Int",
  epa_play: "EPA/Play",
  success_rate: "Success %",
  // projeksiyon
  proj_ppr: "Proj PPR",
  proj_stat: "Proj Yds",
  recent_avg: "Son 5 Ort",
  season_avg: "Sezon Ort",
  matchup_factor: "Matchup",
  scheme_factor: "Şema",
  snap_factor: "Snap",
  injury_status: "Sakatlık",
  report_status: "Durum",
  report_primary_injury: "Sakatlık",
  practice_status: "Antrenman",
  date_modified: "Güncelleme",
  // savunma şeması
  man_rate: "Man %",
  zone_rate: "Zone %",
  epa_vs_man: "EPA vs Man",
  epa_vs_zone: "EPA vs Zone",
  blitz_rate: "Blitz %",
  blitz_rate_ftn: "Blitz % (FTN)",
  avg_box: "Ort. Box",
  avg_pass_rushers: "Ort. Pass Rusher",
};

// 0-1 aralığında olup yüzde olarak gösterilecek kolonlar
export const PERCENT_COLS = new Set([
  "target_share", "air_yards_share", "carry_share", "target_share_calc",
  "rush_yds_share", "rec_yds_share",
  "offense_pct", "defense_pct", "st_pct",
  "off_success_rate", "off_pass_rate", "off_sack_rate", "off_explosive_rate",
  "off_third_down_conv", "off_rz_td_pct",
  "def_success_rate", "def_pass_rate", "def_sack_rate", "def_explosive_rate",
  "def_third_down_conv", "def_rz_td_pct",
  "man_rate", "zone_rate", "blitz_rate", "blitz_rate_ftn",
  "success_rate",
]);

export const label = (col: string): string => {
  if (STAT_LABELS[col]) return STAT_LABELS[col];
  if (col.startsWith("proj_")) return `P·${label(col.slice(5))}`;
  if (col.startsWith("act_")) return `G·${label(col.slice(4))}`;
  // allowed_qb_passing_yards -> "QB'ye Pas Yds (verilen)"
  const m = col.match(/^allowed_(qb|rb|wr|te)_(.+)$/);
  if (m) return `${m[1].toUpperCase()}'ye ${label(m[2])} (verilen)`;
  return col;
};

// Pozisyon grubuna göre gösterilecek istatistik kolonları
export const POSITION_PRESETS: Record<string, string[]> = {
  QB: [
    "completions", "attempts", "passing_yards", "passing_tds",
    "passing_interceptions", "sacks_suffered", "passing_epa",
    "carries", "rushing_yards", "rushing_tds", "fantasy_points_ppr",
  ],
  RB: [
    "carries", "rushing_yards", "rushing_tds", "carry_share",
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
    if (PERCENT_COLS.has(col)) return `${(v * 100).toFixed(1)}%`;
    if (Number.isInteger(v)) return String(v);
    return Math.abs(v) < 10 ? v.toFixed(2) : v.toFixed(1);
  }
  return String(v);
}
