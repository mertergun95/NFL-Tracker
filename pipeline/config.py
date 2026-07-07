"""Pipeline yapılandırması: sezonlar, kaynak URL'leri, kolon seçimleri."""
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = REPO_ROOT / "web" / "public" / "data"

# Geçmiş 5 sezon (backfill)
BACKFILL_SEASONS = [2021, 2022, 2023, 2024, 2025]

NFLVERSE_BASE = "https://github.com/nflverse/nflverse-data/releases/download"

# Haftalık oyuncu istatistikleri: önce yeni isimlendirme (calculate_stats),
# olmazsa eski player_stats release'i (hücum/savunma/kicking ayrı dosyalar).
PLAYER_WEEK_CANDIDATES = [
    "{base}/stats_player/stats_player_week_{season}.csv.gz",
    "{base}/stats_player/stats_player_week_{season}.csv",
]
PLAYER_WEEK_LEGACY = [
    "{base}/player_stats/player_stats_{season}.csv.gz",
    "{base}/player_stats/player_stats_def_{season}.csv.gz",
    "{base}/player_stats/player_stats_kicking_{season}.csv.gz",
]

TEAM_WEEK_CANDIDATES = [
    "{base}/stats_team/stats_team_week_{season}.csv.gz",
    "{base}/stats_team/stats_team_week_{season}.csv",
]

PLAYERS_MASTER_CANDIDATES = [
    "{base}/players/players.csv.gz",
    "{base}/players/players.csv",
]

# Maç programı + skorlar (nflverse games.csv aynası; GitHub dışı olduğu için her ortamda erişilir)
SCHEDULE_URLS = [
    "http://www.habitatring.com/games.csv",
    "https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv",
]

# --- Ek veri setleri (Faz 1.5: advanced/rz/snap/şema) ---

SNAP_COUNTS_CANDIDATES = [
    "{base}/snap_counts/snap_counts_{season}.csv.gz",
    "{base}/snap_counts/snap_counts_{season}.csv",
]
NGS_CANDIDATES = [  # stat_type: passing | rushing | receiving
    "{base}/nextgen_stats/ngs_{season}_{stat_type}.csv.gz",
    "{base}/nextgen_stats/ngs_{season}_{stat_type}.csv",
]
PBP_CANDIDATES = [
    "{base}/pbp/play_by_play_{season}.csv.gz",
]
PARTICIPATION_CANDIDATES = [
    "{base}/pbp_participation/pbp_participation_{season}.csv.gz",
    "{base}/pbp_participation/pbp_participation_{season}.csv",
]
FTN_CANDIDATES = [
    "{base}/ftn_charting/ftn_charting_{season}.csv.gz",
    "{base}/ftn_charting/ftn_charting_{season}.csv",
]

# pbp'den yalnızca ihtiyaç duyulan kolonlar (bellek için)
PBP_USECOLS = [
    "game_id", "play_id", "season_type", "week", "posteam", "defteam",
    "yardline_100", "down", "ydstogo", "play_type", "yards_gained",
    "rush_attempt", "pass_attempt", "complete_pass", "sack", "qb_dropback",
    "pass", "rush", "touchdown", "rush_touchdown", "pass_touchdown",
    "interception", "fumble_lost", "first_down", "epa", "success",
    "rusher_player_id", "receiver_player_id", "passer_player_id",
    "fixed_drive", "fixed_drive_result", "two_point_attempt",
]

SNAP_COUNT_COLS = [
    "player_id", "player", "position", "team", "opponent",
    "season", "game_type", "week",
    "offense_snaps", "offense_pct", "defense_snaps", "defense_pct",
    "st_snaps", "st_pct",
]

NGS_COLS = {
    "passing": [
        "week", "season_type", "player_gsis_id", "player_display_name",
        "team_abbr", "attempts", "pass_yards", "pass_touchdowns", "interceptions",
        "passer_rating", "completion_percentage",
        "expected_completion_percentage", "completion_percentage_above_expectation",
        "avg_time_to_throw", "avg_intended_air_yards", "avg_completed_air_yards",
        "avg_air_yards_differential", "aggressiveness", "avg_air_yards_to_sticks",
        "max_completed_air_distance",
    ],
    "rushing": [
        "week", "season_type", "player_gsis_id", "player_display_name",
        "team_abbr", "rush_attempts", "rush_yards", "rush_touchdowns",
        "efficiency", "percent_attempts_gte_eight_defenders", "avg_time_to_los",
        "expected_rush_yards", "rush_yards_over_expected",
        "rush_yards_over_expected_per_att", "rush_pct_over_expected",
    ],
    "receiving": [
        "week", "season_type", "player_gsis_id", "player_display_name",
        "team_abbr", "targets", "receptions", "yards", "rec_touchdowns",
        "catch_percentage", "avg_cushion", "avg_separation",
        "avg_intended_air_yards", "percent_share_of_intended_air_yards",
        "avg_yac", "avg_expected_yac", "avg_yac_above_expectation",
    ],
}

# Eski kolon adı -> kanonik ad
PLAYER_RENAMES = {
    "player_display_name": "player_name",
    "recent_team": "team",
    "interceptions": "passing_interceptions",
    "sacks": "sacks_suffered",
}

# Haftalık oyuncu dosyasında tutulacak kolonlar (mevcut olanlarla kesişim alınır)
PLAYER_WEEK_COLS = [
    "player_id", "player_name", "position", "position_group", "headshot_url",
    "team", "opponent_team", "season", "week", "season_type",
    # pas
    "completions", "attempts", "passing_yards", "passing_tds",
    "passing_interceptions", "sacks_suffered", "passing_air_yards",
    "passing_yards_after_catch", "passing_epa",
    # koşu
    "carries", "rushing_yards", "rushing_tds", "rushing_fumbles",
    "rushing_fumbles_lost", "rushing_epa",
    # hava oyunu
    "receptions", "targets", "receiving_yards", "receiving_tds",
    "receiving_air_yards", "receiving_yards_after_catch",
    "target_share", "air_yards_share", "receiving_epa",
    # kicking
    "fg_made", "fg_att", "fg_long", "fg_pct", "pat_made", "pat_att",
    # savunma
    "def_tackles_solo", "def_tackle_assists", "def_tackles_with_assist",
    "def_sacks", "def_interceptions", "def_pass_defended",
    "def_tds", "def_fumbles_forced", "def_fumble_recovery_opp",
    # fantasy
    "fantasy_points", "fantasy_points_ppr",
]

# Sezon toplamında toplanacak sayısal kolonlar (meta kolonlar hariç hepsi)
PLAYER_META_COLS = [
    "player_id", "player_name", "position", "position_group", "headshot_url",
    "team", "opponent_team", "season", "week", "season_type",
]
# Toplam yerine ortalaması alınacak oran kolonları
PLAYER_RATE_COLS = ["target_share", "air_yards_share", "fg_pct"]

TEAM_WEEK_COLS = [
    "team", "opponent_team", "season", "week", "season_type",
    "completions", "attempts", "passing_yards", "passing_tds",
    "passing_interceptions", "sacks_suffered",
    "carries", "rushing_yards", "rushing_tds",
    "receptions", "targets", "receiving_yards", "receiving_tds",
    "fg_made", "fg_att", "def_sacks", "def_interceptions",
    "fantasy_points", "fantasy_points_ppr",
]

SCHEDULE_COLS = [
    "game_id", "season", "game_type", "week", "gameday", "weekday", "gametime",
    "away_team", "away_score", "home_team", "home_score",
    "result", "total", "overtime", "div_game", "roof", "surface",
    "away_rest", "home_rest", "stadium",
]

PLAYERS_MASTER_COLS = [
    "gsis_id", "display_name", "position", "height", "weight",
    "birth_date", "college_name", "rookie_season", "entry_year",
    "draft_club", "draft_number", "headshot",
]
