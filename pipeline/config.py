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
