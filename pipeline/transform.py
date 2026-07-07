"""Ham DataFrame'leri web arayüzünün tükettiği kompakt JSON'lara dönüştürür.

JSON biçimi (kolonsal, küçük dosya boyutu için):
    {"columns": ["player_id", "passing_yards", ...], "rows": [[...], [...]]}
"""
import json
import logging
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

import config

log = logging.getLogger(__name__)


def _clean(df: pd.DataFrame, cols: list[str], renames: dict | None = None) -> pd.DataFrame:
    if renames:
        df = df.rename(columns={k: v for k, v in renames.items() if k in df.columns})
    keep = [c for c in cols if c in df.columns]
    missing = [c for c in cols if c not in df.columns]
    if missing:
        log.info("Eksik kolonlar (atlandı): %s", missing)
    df = df[keep].copy()
    for c in df.select_dtypes(include=["float"]).columns:
        df[c] = df[c].round(2)
    return df


def write_json(path: Path, df: pd.DataFrame) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    df = df.replace({np.nan: None})
    payload = {"columns": list(df.columns), "rows": df.values.tolist()}
    with open(path, "w") as f:
        json.dump(payload, f, separators=(",", ":"), default=str)
    log.info("Yazıldı: %s (%d satır, %.1f KB)", path.relative_to(config.REPO_ROOT),
             len(df), path.stat().st_size / 1024)


def read_json(path: Path) -> pd.DataFrame | None:
    if not path.exists():
        return None
    with open(path) as f:
        payload = json.load(f)
    return pd.DataFrame(payload["rows"], columns=payload["columns"])


def build_player_weeks(raw: pd.DataFrame, season: int) -> pd.DataFrame:
    df = _clean(raw, config.PLAYER_WEEK_COLS, config.PLAYER_RENAMES)
    df = df[df["season"] == season]
    # REG + POST tut, preseason'ı at
    if "season_type" in df.columns:
        df = df[df["season_type"].isin(["REG", "POST"])]
    return df.reset_index(drop=True)


def build_player_season(weeks: pd.DataFrame) -> pd.DataFrame:
    """Sezon toplamları (REG). Oran kolonlarında ortalama, diğerlerinde toplam."""
    reg = weeks[weeks["season_type"] == "REG"] if "season_type" in weeks.columns else weeks
    if reg.empty:
        return pd.DataFrame()
    stat_cols = [c for c in reg.columns if c not in config.PLAYER_META_COLS]
    agg = {c: ("mean" if c in config.PLAYER_RATE_COLS else "sum") for c in stat_cols}
    grouped = reg.groupby("player_id").agg(games=("week", "nunique"), **{
        c: (c, fn) for c, fn in agg.items()
    })
    meta = (reg.sort_values("week")
               .groupby("player_id")[["player_name", "position", "position_group",
                                      "headshot_url", "team", "season"]]
               .last())
    out = meta.join(grouped).reset_index()
    for c in out.select_dtypes(include=["float"]).columns:
        out[c] = out[c].round(2)
    return out


def build_team_weeks(raw: pd.DataFrame | None, player_weeks: pd.DataFrame,
                     season: int) -> pd.DataFrame:
    if raw is not None:
        df = _clean(raw, config.TEAM_WEEK_COLS, config.PLAYER_RENAMES)
        df = df[df["season"] == season]
        if "season_type" in df.columns:
            df = df[df["season_type"].isin(["REG", "POST"])]
        return df.reset_index(drop=True)
    # Yedek plan: oyuncu istatistiklerini takım-hafta bazında topla
    log.warning("Takım istatistiği kaynağı yok; oyuncu verisinden türetiliyor")
    meta = ["team", "opponent_team", "season", "week", "season_type"]
    stat_cols = [c for c in config.TEAM_WEEK_COLS
                 if c not in meta and c in player_weeks.columns]
    df = (player_weeks.groupby(meta, dropna=False)[stat_cols]
                      .sum().round(2).reset_index())
    return df


def build_team_season(team_weeks: pd.DataFrame, schedule: pd.DataFrame) -> pd.DataFrame:
    reg = team_weeks[team_weeks["season_type"] == "REG"]
    meta = ["team", "opponent_team", "season", "week", "season_type"]
    stat_cols = [c for c in reg.columns if c not in meta]
    out = (reg.groupby("team")
              .agg(games=("week", "nunique"), **{c: (c, "sum") for c in stat_cols})
              .reset_index())
    # Maç sonuçlarından galibiyet/mağlubiyet ve sayılar
    sched = schedule[schedule["game_type"] == "REG"]
    recs = []
    for _, g in sched.iterrows():
        if pd.isna(g.get("home_score")) or pd.isna(g.get("away_score")):
            continue
        hs, as_ = g["home_score"], g["away_score"]
        recs.append({"team": g["home_team"], "pf": hs, "pa": as_,
                     "win": int(hs > as_), "loss": int(hs < as_), "tie": int(hs == as_)})
        recs.append({"team": g["away_team"], "pf": as_, "pa": hs,
                     "win": int(as_ > hs), "loss": int(as_ < hs), "tie": int(hs == as_)})
    if recs:
        rec_df = (pd.DataFrame(recs).groupby("team").sum()
                    .rename(columns={"pf": "points_for", "pa": "points_against",
                                     "win": "wins", "loss": "losses", "tie": "ties"})
                    .reset_index())
        out = out.merge(rec_df, on="team", how="left")
    for c in out.select_dtypes(include=["float"]).columns:
        out[c] = out[c].round(2)
    return out


def build_schedule(all_games: pd.DataFrame, season: int) -> pd.DataFrame:
    df = all_games[all_games["season"] == season]
    return _clean(df, config.SCHEDULE_COLS).reset_index(drop=True)


def build_players_index(season_dfs: dict[int, pd.DataFrame],
                        master: pd.DataFrame | None) -> pd.DataFrame:
    """Tüm sezonlardaki oyuncuların arama dizini (sezon toplam dosyalarından)."""
    frames = [df.assign(season=season) for season, df in season_dfs.items() if not df.empty]
    if not frames:
        return pd.DataFrame()
    allp = pd.concat(frames, ignore_index=True)
    allp = allp.sort_values("season")
    idx = allp.groupby("player_id").agg(
        player_name=("player_name", "last"),
        position=("position", "last"),
        team=("team", "last"),
        headshot_url=("headshot_url", "last"),
        first_season=("season", "min"),
        last_season=("season", "max"),
        seasons=("season", lambda s: sorted(set(int(x) for x in s))),
    ).reset_index()
    if master is not None and "gsis_id" in master.columns:
        m = _clean(master, config.PLAYERS_MASTER_COLS)
        m = m.rename(columns={"gsis_id": "player_id"})
        m = m.drop(columns=[c for c in ("display_name", "position", "headshot") if c in m.columns])
        idx = idx.merge(m, on="player_id", how="left")
    return idx


def build_manifest(data_dir: Path) -> None:
    seasons = {}
    for sdir in sorted((data_dir / "seasons").glob("*")):
        pw = read_json(sdir / "player_weeks.json")
        if pw is None or pw.empty:
            continue
        reg = pw[pw["season_type"] == "REG"] if "season_type" in pw.columns else pw
        post = pw[pw["season_type"] == "POST"] if "season_type" in pw.columns else pw.iloc[0:0]
        seasons[sdir.name] = {
            "last_reg_week": int(reg["week"].max()) if not reg.empty else 0,
            "last_post_week": int(post["week"].max()) if not post.empty else 0,
            "player_week_rows": int(len(pw)),
        }
    manifest = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "seasons": seasons,
        "sources": ["nflverse", "nfldata (schedules)"],
    }
    with open(data_dir / "manifest.json", "w") as f:
        json.dump(manifest, f, indent=1)
    log.info("Manifest güncellendi: %s sezon", len(seasons))
