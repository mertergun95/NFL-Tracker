// İstatistik kolonlarının kısa etiketleri ve pozisyona göre tablo ön ayarları.
// Değer tek dizeyse üç dilde aynıdır, üçlüyse [en, tr, de] sırasındadır.
import { getLang, LANGS } from "./i18n";

export const STAT_LABELS: Record<string, string | [string, string, string]> = {
  player_name: ["Player", "Oyuncu", "Spieler"],
  position: ["Pos", "Poz", "Pos"],
  team: ["Team", "Takım", "Team"],
  opponent_team: ["Opp", "Rakip", "Gegner"],
  season: ["Season", "Sezon", "Saison"],
  week: ["Week", "Hafta", "Woche"],
  season_type: ["Type", "Tip", "Typ"],
  games: ["GP", "Maç", "Sp"],
  completions: "Cmp",
  attempts: "Att",
  passing_yards: ["Pass Yds", "Pas Yds", "Pass Yds"],
  passing_tds: ["Pass TD", "Pas TD", "Pass TD"],
  passing_interceptions: "Int",
  sacks_suffered: "Sack",
  passing_air_yards: "Air Yds",
  passing_yards_after_catch: ["Pass YAC", "Pas YAC", "Pass YAC"],
  passing_epa: ["Pass EPA", "Pas EPA", "Pass EPA"],
  carries: ["Car", "Koşu", "Läufe"],
  rushing_yards: ["Rush Yds", "Koşu Yds", "Rush Yds"],
  rushing_tds: ["Rush TD", "Koşu TD", "Rush TD"],
  rushing_fumbles: "Fum",
  rushing_fumbles_lost: ["Fum Lost", "Fum Kayıp", "Fum verloren"],
  rushing_epa: ["Rush EPA", "Koşu EPA", "Rush EPA"],
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
  fg_long: ["FG Long", "FG Uzun", "FG lang"],
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
  wins: ["W", "G", "S"],
  losses: ["L", "M", "N"],
  ties: ["T", "B", "U"],
  points_for: ["PF", "Atılan Sayı", "Erz. Punkte"],
  points_against: ["PA", "Yenilen Sayı", "Gegenpunkte"],
  gametime: ["Time (ET)", "Saat (ET)", "Zeit (ET)"],
  saat_de: ["Time (DE) 🕐", "Saat (DE) 🕐", "Zeit (DE) 🕐"],
  // NCAA (ESPN box score) kolonları
  jersey: "#",
  class: ["Class", "Sınıf", "Jahrgang"],
  turnovers: ["TO", "Top Kaybı", "Ballverluste"],
  qbr: "QBR",
  rush_long: ["Long Rush", "En Uzun Koşu", "Längster Lauf"],
  rec_long: ["Long Rec", "En Uzun Rec", "Längster Fang"],
  first_downs: ["1st Downs", "İlk Down", "First Downs"],
  total_yards: ["Total Yds", "Toplam Yd", "Yards ges."],
  rushing_attempts: ["Rush Att", "Koşu Denemesi", "Laufversuche"],
  yards_per_pass: ["Yds/Pass", "Yd/Pas", "Yds/Pass"],
  yards_per_rush: ["Yds/Rush", "Yd/Koşu", "Yds/Lauf"],
  third_down_pct: ["3rd Down %", "3. Down %", "3rd Down %"],
  points: ["Points", "Sayı", "Punkte"],
  points_allowed: ["Allowed", "Yenilen", "Gegenpunkte"],
  points_pg: ["Pts/G", "Sayı/Maç", "Pkt./Sp"],
  points_allowed_pg: ["Allow/G", "Yenilen/Maç", "Gegenpkt./Sp"],
  total_yards_pg: ["Yds/G", "Yd/Maç", "Yds/Sp"],
  passing_yards_pg: ["Pass Yds/G", "Pas Yd/Maç", "Pass Yds/Sp"],
  rushing_yards_pg: ["Rush Yds/G", "Koşu Yd/Maç", "Rush Yds/Sp"],
  turnovers_pg: ["TO/G", "TO/Maç", "TO/Sp"],
  third_down_pct_pg: ["3rd Down %", "3. Down %", "3rd Down %"],
  conf_wins: ["Conf W", "Konf G", "Conf S"],
  conf_losses: ["Conf L", "Konf M", "Conf N"],
  conference: ["Conference", "Konferans", "Conference"],
  // paylar
  carry_share: ["Rush %", "Koşu %", "Rush %"],
  target_share_calc: "Tgt %",
  rush_yds_share: ["Rush Yds %", "Koşu Yds %", "Rush Yds %"],
  rec_yds_share: "Rec Yds %",
  // red zone
  rz_carries: ["RZ Rush", "RZ Koşu", "RZ Rush"],
  rz_rush_tds: ["RZ Rush TD", "RZ Koşu TD", "RZ Rush TD"],
  rz_targets: "RZ Tgt",
  rz_receptions: "RZ Rec",
  rz_rec_tds: "RZ Rec TD",
  rz_pass_att: ["RZ Pass Att", "RZ Pas Att", "RZ Pass Att"],
  rz_pass_tds: ["RZ Pass TD", "RZ Pas TD", "RZ Pass TD"],
  rz_pass_ints: "RZ Int",
  i10_carries: ["I-10 Rush", "İç-10 Koşu", "I-10 Rush"],
  i10_rush_tds: ["I-10 Rush TD", "İç-10 Koşu TD", "I-10 Rush TD"],
  i10_targets: ["I-10 Tgt", "İç-10 Tgt", "I-10 Tgt"],
  i10_receptions: ["I-10 Rec", "İç-10 Rec", "I-10 Rec"],
  i10_rec_tds: ["I-10 Rec TD", "İç-10 Rec TD", "I-10 Rec TD"],
  i10_pass_att: ["I-10 Pass Att", "İç-10 Pas Att", "I-10 Pass Att"],
  i10_pass_tds: ["I-10 Pass TD", "İç-10 Pas TD", "I-10 Pass TD"],
  i10_pass_ints: ["I-10 Int", "İç-10 Int", "I-10 Int"],
  // snap counts
  offense_snaps: ["Off Snaps", "Hücum Snap", "Off Snaps"],
  offense_pct: ["Off Snap %", "Hücum Snap %", "Off Snap %"],
  defense_snaps: ["Def Snaps", "Sav. Snap", "Def Snaps"],
  defense_pct: ["Def Snap %", "Sav. Snap %", "Def Snap %"],
  st_snaps: "ST Snap",
  st_pct: "ST Snap %",
  opponent: ["Opp", "Rakip", "Gegner"],
  game_type: ["Type", "Tip", "Typ"],
  player: ["Player", "Oyuncu", "Spieler"],
  // NGS passing
  avg_time_to_throw: ["Time to Throw (s)", "Atış Süresi (sn)", "Wurfzeit (s)"],
  avg_intended_air_yards: ["Intended Air Yds", "Hedef Air Yds", "Intended Air Yds"],
  avg_completed_air_yards: ["Compl. Air Yds", "Tamam. Air Yds", "Compl. Air Yds"],
  avg_air_yards_differential: ["Air Yds Diff", "Air Yds Farkı", "Air Yds Diff"],
  aggressiveness: ["Aggressiveness %", "Agresiflik %", "Aggressivität %"],
  avg_air_yards_to_sticks: ["Air Yds to Sticks", "Sticks'e Air Yds", "Air Yds to Sticks"],
  max_completed_air_distance: ["Max Air Distance", "Maks Hava Mesafesi", "Max. Luftdistanz"],
  passer_rating: "Rating",
  completion_percentage: "Cmp %",
  expected_completion_percentage: "xCmp %",
  completion_percentage_above_expectation: "CPOE",
  pass_yards: ["Pass Yds", "Pas Yds", "Pass Yds"],
  pass_touchdowns: ["Pass TD", "Pas TD", "Pass TD"],
  interceptions: "Int",
  // NGS rushing
  rush_attempts: ["Rush", "Koşu", "Läufe"],
  rush_yards: ["Rush Yds", "Koşu Yds", "Rush Yds"],
  rush_touchdowns: ["Rush TD", "Koşu TD", "Rush TD"],
  efficiency: ["Efficiency", "Verimlilik", "Effizienz"],
  percent_attempts_gte_eight_defenders: "8+ Box %",
  avg_time_to_los: ["Time to LOS (s)", "LOS Süresi (sn)", "Zeit bis LOS (s)"],
  expected_rush_yards: ["xRush Yds", "xKoşu Yds", "xRush Yds"],
  rush_yards_over_expected: "RYOE",
  rush_yards_over_expected_per_att: "RYOE/Att",
  rush_pct_over_expected: "ROE %",
  // NGS receiving
  yards: "Yds",
  rec_touchdowns: "Rec TD",
  catch_percentage: "Catch %",
  avg_cushion: "Cushion",
  avg_separation: ["Separation", "Ayrışma", "Separation"],
  percent_share_of_intended_air_yards: ["Air Yds Share %", "Air Yds Pay %", "Air-Yds-Anteil %"],
  avg_yac: ["Avg YAC", "Ort YAC", "Ø YAC"],
  avg_expected_yac: "xYAC",
  avg_yac_above_expectation: "YAC+",
  // takım advanced
  off_plays: ["Off Plays", "Hücum Play", "Off Plays"],
  off_epa_play: ["Off EPA/Play", "Hücum EPA/Play", "Off EPA/Play"],
  off_success_rate: ["Off Success %", "Hücum Success %", "Off Success %"],
  off_pass_rate: ["Pass Rate", "Pas Oranı", "Pass-Quote"],
  off_pass_epa: ["Pass EPA/Play", "Pas EPA/Play", "Pass EPA/Play"],
  off_rush_epa: ["Rush EPA/Play", "Koşu EPA/Play", "Rush EPA/Play"],
  off_sack_rate: ["Sacks Taken %", "Yenen Sack %", "Kassierte Sacks %"],
  off_explosive_rate: "Explosive %",
  off_third_down_conv: ["3rd Down %", "3. Down %", "3rd Down %"],
  off_rz_td_pct: "RZ TD %",
  off_turnovers: ["Turnovers", "Top Kaybı", "Ballverluste"],
  def_plays: ["Def Plays", "Sav. Play", "Def Plays"],
  def_epa_play: ["Def EPA/Play", "Sav. EPA/Play", "Def EPA/Play"],
  def_success_rate: ["Def Success %", "Sav. Success %", "Def Success %"],
  def_pass_rate: ["Opp Pass Rate", "Rakip Pas Oranı", "Gegner-Pass-Quote"],
  def_pass_epa: ["Pass EPA (allowed)", "Pas EPA (verilen)", "Pass EPA (zugel.)"],
  def_rush_epa: ["Rush EPA (allowed)", "Koşu EPA (verilen)", "Rush EPA (zugel.)"],
  def_sack_rate: "Sack %",
  def_explosive_rate: ["Explosive % (allowed)", "Explosive % (verilen)", "Explosive % (zugel.)"],
  def_third_down_conv: ["3rd Down % (allowed)", "3. Down % (verilen)", "3rd Down % (zugel.)"],
  def_rz_td_pct: ["RZ TD % (allowed)", "RZ TD % (verilen)", "RZ TD % (zugel.)"],
  def_turnovers: ["Takeaways", "Top Çalma", "Takeaways"],
  // oyuncu şema splitleri
  split_play_action: "Play Action",
  split_no_play_action: ["No PA", "PA'sız", "ohne PA"],
  split_vs_blitz: ["vs Blitz", "Blitze Karşı", "gg. Blitz"],
  split_no_blitz: ["No Blitz", "Blitzsiz", "ohne Blitz"],
  split_shotgun: "Shotgun",
  split_under_center: "Under Center",
  split_heavy_box: "8+ Box",
  split_light_box: ["Light Box", "Hafif Box", "Light Box"],
  split_screen: "Screen",
  split: ["Context", "Bağlam", "Kontext"],
  plays: "Play",
  tds: "TD",
  ints: "Int",
  epa_play: "EPA/Play",
  success_rate: "Success %",
  // projeksiyon
  proj_ppr: "Proj PPR",
  proj_stat: "Proj Yds",
  proj_range: ["Floor–Ceiling", "Taban–Tavan", "Boden–Decke"],
  recent_avg: ["Last 5 Avg", "Son 5 Ort", "Ø letzte 5"],
  season_avg: ["Season Avg", "Sezon Ort", "Ø Saison"],
  matchup_factor: "Matchup",
  scheme_factor: ["Scheme", "Şema", "Scheme"],
  snap_factor: "Snap",
  injury_status: ["Injury", "Sakatlık", "Verletzung"],
  report_status: ["Status", "Durum", "Status"],
  report_primary_injury: ["Injury", "Sakatlık", "Verletzung"],
  practice_status: ["Practice", "Antrenman", "Training"],
  date_modified: ["Updated", "Güncelleme", "Aktualisiert"],
  // savunma şeması
  man_rate: "Man %",
  zone_rate: "Zone %",
  epa_vs_man: "EPA vs Man",
  epa_vs_zone: "EPA vs Zone",
  blitz_rate: "Blitz %",
  blitz_rate_ftn: "Blitz % (FTN)",
  avg_box: ["Avg Box", "Ort. Box", "Ø Box"],
  avg_pass_rushers: ["Avg Pass Rushers", "Ort. Pass Rusher", "Ø Pass Rusher"],
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

const ACT_PREFIX = { en: "A", tr: "G", de: "T" };
const ALLOWED_FMT = {
  en: (pos: string, stat: string) => `${stat} allowed to ${pos}`,
  tr: (pos: string, stat: string) => `${pos}'ye ${stat} (verilen)`,
  de: (pos: string, stat: string) => `${stat} an ${pos} zugelassen`,
};

export const label = (col: string): string => {
  const entry = STAT_LABELS[col];
  if (entry)
    return typeof entry === "string"
      ? entry : entry[LANGS.indexOf(getLang())] ?? entry[0];
  if (col.startsWith("proj_")) return `P·${label(col.slice(5))}`;
  if (col.startsWith("act_")) return `${ACT_PREFIX[getLang()]}·${label(col.slice(4))}`;
  // allowed_qb_passing_yards -> "Pass Yds allowed to QB"
  const m = col.match(/^allowed_(qb|rb|wr|te)_(.+)$/);
  if (m) return ALLOWED_FMT[getLang()](m[1].toUpperCase(), label(m[2]));
  return col;
};

/** Yüzdeyi dile göre biçimler: TR "%60", EN "60%", DE "60 %". */
export function pct(v: number | string): string {
  const lang = getLang();
  return lang === "tr" ? `%${v}` : lang === "de" ? `${v} %` : `${v}%`;
}

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

/** Taban–tavan aralığı: iki uç aynı hassasiyetle yazılır ("8.6 – 19.0"). */
export function fmtRange(col: string, lo: number, hi: number): string {
  if (PERCENT_COLS.has(col)) return `${fmt(col, lo)} – ${fmt(col, hi)}`;
  const dec = Number.isInteger(lo) && Number.isInteger(hi) ? 0 : 1;
  return `${lo.toFixed(dec)} – ${hi.toFixed(dec)}`;
}

export function fmt(col: string, v: string | number | null): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "number") {
    if (PERCENT_COLS.has(col)) return pct((v * 100).toFixed(1));
    if (Number.isInteger(v)) return String(v);
    return Math.abs(v) < 10 ? v.toFixed(2) : v.toFixed(1);
  }
  return String(v);
}
