"""Kural tabanlı 'key insights' motoru (Faz 5).

İşlenmiş sezon JSON'larından okur; şunları üretir:
- form trendleri (son 3 hafta vs sezon ortalaması, PPR bazlı)
- kullanım değişimi (target/carry share son 3 hafta vs sezon)
- pozisyona karşı verilen sayılar + gelecek hafta matchup notları
- takım güç profili (EPA sıralamaları)

Çıktı: web/public/data/insights.json
"""
import json
import logging
from datetime import datetime, timezone

import pandas as pd

import config
import transform

log = logging.getLogger(__name__)

MIN_GAMES = 5
MIN_PPR_AVG = 6.0
FORM_WINDOW = 3
SKILL_POS = ["QB", "RB", "WR", "TE"]


def _latest_season() -> int | None:
    dirs = sorted((config.DATA_DIR / "seasons").glob("*"))
    return int(dirs[-1].name) if dirs else None


def _read(season: int, name: str) -> pd.DataFrame | None:
    return transform.read_json(config.DATA_DIR / "seasons" / str(season) / f"{name}.json")


# ------------------------------------------------------------------ form

def form_trends(pw: pd.DataFrame, last_week: int) -> tuple[list, list]:
    reg = pw[(pw["season_type"] == "REG")
             & pw["position"].isin(SKILL_POS)
             & pw["fantasy_points_ppr"].notna()]
    window = reg[reg["week"] > last_week - FORM_WINDOW]
    season_avg = reg.groupby("player_id").agg(
        games=("week", "nunique"), avg=("fantasy_points_ppr", "mean"),
        name=("player_name", "last"), pos=("position", "last"), team=("team", "last"))
    win_avg = window.groupby("player_id")["fantasy_points_ppr"].mean().rename("recent")
    j = season_avg.join(win_avg, how="inner")
    j = j[(j["games"] >= MIN_GAMES) & (j["avg"] >= MIN_PPR_AVG)]
    j["diff"] = j["recent"] - j["avg"]

    def items(rows, emoji):
        out = []
        for pid, r in rows.iterrows():
            out.append({
                "player_id": pid, "team": r["team"],
                "title": f"{emoji} {r['name']} ({r['pos']}, {r['team']})",
                "detail": (f"Son {FORM_WINDOW} haftada {r['recent']:.1f} PPR/maç — "
                           f"sezon ortalaması {r['avg']:.1f} ({r['diff']:+.1f})."),
                "value": round(float(r["diff"]), 1),
            })
        return out

    hot = items(j[j["diff"] >= 4].sort_values("diff", ascending=False).head(8), "🔥")
    cold = items(j[j["diff"] <= -4].sort_values("diff").head(8), "🧊")
    return hot, cold


# ----------------------------------------------------------------- usage

def usage_shifts(pw: pd.DataFrame, last_week: int) -> list:
    out = []
    specs = [("target_share", ["WR", "TE", "RB"], 0.05, 0.15, "hedef payı"),
             ("carry_share", ["RB"], 0.08, 0.35, "koşu payı")]
    reg = pw[pw["season_type"] == "REG"]
    for col, poss, min_up, min_level, label_tr in specs:
        if col not in reg.columns:
            continue
        sub = reg[reg["position"].isin(poss) & reg[col].notna()]
        season = sub.groupby("player_id").agg(
            games=("week", "nunique"), avg=(col, "mean"),
            name=("player_name", "last"), pos=("position", "last"),
            team=("team", "last"))
        recent = (sub[sub["week"] > last_week - FORM_WINDOW]
                  .groupby("player_id")[col].mean().rename("recent"))
        j = season.join(recent, how="inner")
        j = j[(j["games"] >= MIN_GAMES) & (j["recent"] >= min_level)]
        j["diff"] = j["recent"] - j["avg"]
        for pid, r in (j[j["diff"] >= min_up]
                       .sort_values("diff", ascending=False).head(6)).iterrows():
            out.append({
                "player_id": pid, "team": r["team"],
                "title": f"📈 {r['name']} ({r['pos']}, {r['team']})",
                "detail": (f"Son {FORM_WINDOW} haftada {label_tr} "
                           f"%{r['recent']*100:.0f} — sezon ortalaması "
                           f"%{r['avg']*100:.0f} (+{r['diff']*100:.0f} puan)."),
                "value": round(float(r["diff"]), 3),
            })
    return sorted(out, key=lambda x: -x["value"])[:10]


# ------------------------------------------------- pozisyona karşı verilen

def points_allowed(pw: pd.DataFrame) -> pd.DataFrame:
    """Takım başına pozisyona verilen PPR/maç ve lig sırası (yüksek sıra = çok veriyor)."""
    reg = pw[(pw["season_type"] == "REG") & pw["position"].isin(SKILL_POS)]
    per_game = (reg.groupby(["opponent_team", "position", "week"])
                   ["fantasy_points_ppr"].sum().reset_index())
    avg = (per_game.groupby(["opponent_team", "position"])
                   ["fantasy_points_ppr"].mean().reset_index()
                   .rename(columns={"opponent_team": "team",
                                    "fantasy_points_ppr": "ppr_allowed"}))
    avg["rank"] = avg.groupby("position")["ppr_allowed"].rank(
        ascending=False, method="min").astype(int)  # 1 = en çok veren
    return avg


# ------------------------------------------------------------- matchuplar

def _ranks(ta: pd.DataFrame) -> pd.DataFrame:
    r = ta[["team"]].copy()
    r["off_pass"] = ta["off_pass_epa"].rank(ascending=False, method="min")
    r["off_rush"] = ta["off_rush_epa"].rank(ascending=False, method="min")
    r["def_pass"] = ta["def_pass_epa"].rank(ascending=True, method="min")
    r["def_rush"] = ta["def_rush_epa"].rank(ascending=True, method="min")
    return r.set_index("team")


def upcoming_games(schedules: pd.DataFrame, season: int) -> tuple[pd.DataFrame, int, int]:
    """Sıradaki oynanmamış hafta: önce mevcut sezon, yoksa sonraki sezonun 1. haftası."""
    for target in (season, season + 1):
        s = schedules[(schedules["season"] == target)
                      & (schedules["game_type"] == "REG")
                      & schedules["home_score"].isna()]
        if not s.empty:
            wk = int(s["week"].min())
            return s[s["week"] == wk], target, wk
    return pd.DataFrame(), season, 0


def matchup_notes(games: pd.DataFrame, ranks: pd.DataFrame,
                  allowed: pd.DataFrame, ps: pd.DataFrame,
                  data_season: int) -> list:
    notes = []
    star = ps[ps["position"].isin(["RB", "WR", "TE"])]

    def top_players(team, pos, n=2):
        rows = star[(star["team"] == team) & (star["position"] == pos)]
        rows = rows.sort_values("fantasy_points_ppr", ascending=False).head(n)
        return ", ".join(str(r) for r in rows["player_name"])

    for _, g in games.iterrows():
        for off, deff in ((g["away_team"], g["home_team"]),
                          (g["home_team"], g["away_team"])):
            if off not in ranks.index or deff not in ranks.index:
                continue
            ro, rd = ranks.loc[off], ranks.loc[deff]
            game_lbl = f"{g['away_team']} @ {g['home_team']}"
            for kind, lbl in (("pass", "pas"), ("rush", "koşu")):
                o, d = int(ro[f"off_{kind}"]), int(rd[f"def_{kind}"])
                if o <= 10 and d >= 23:
                    notes.append({
                        "team": off, "game": game_lbl,
                        "title": f"⚔️ {game_lbl}: {off} {lbl} hücumu avantajlı",
                        "detail": (f"{off} {lbl} hücumu EPA'da lig #{o}, "
                                   f"{deff} {lbl} savunması #{d} "
                                   f"({data_season} verisi). Patlama potansiyeli."),
                        "value": d - o,
                    })
            # pozisyona karşı en cömert savunmalar
            for pos in ("WR", "RB", "TE"):
                row = allowed[(allowed["team"] == deff) & (allowed["position"] == pos)]
                if row.empty:
                    continue
                rank, val = int(row["rank"].iloc[0]), float(row["ppr_allowed"].iloc[0])
                if rank <= 4:
                    players = top_players(off, pos)
                    if players:
                        notes.append({
                            "team": off, "game": game_lbl,
                            "title": f"🎯 {game_lbl}: {deff}, {pos} pozisyonuna cömert",
                            "detail": (f"{deff} savunması {pos}'lara maç başına "
                                       f"{val:.1f} PPR verdi (lig #{rank}, "
                                       f"{data_season}). Takip et: {players}."),
                            "value": 33 - rank,
                        })
    return sorted(notes, key=lambda x: -x["value"])[:14]


# ------------------------------------------------------------- takım gücü

def team_power(ta: pd.DataFrame) -> list:
    out = []
    for col, asc, emoji, lbl in (
        ("off_epa_play", False, "🚀", "Hücum EPA/play"),
        ("def_epa_play", True, "🛡️", "Savunma EPA/play (verilen)"),
    ):
        s = ta.sort_values(col, ascending=asc).head(3)
        for i, (_, r) in enumerate(s.iterrows(), 1):
            out.append({
                "team": r["team"],
                "title": f"{emoji} {r['team']} — {lbl} lig #{i}",
                "detail": f"{lbl}: {r[col]:+.3f}",
                "value": float(r[col]),
            })
    return out


# ------------------------------------------------------------------ main

def build_and_write(schedules: pd.DataFrame) -> None:
    season = _latest_season()
    if season is None:
        log.warning("İşlenmiş sezon yok, insights atlandı")
        return
    pw = _read(season, "player_weeks")
    ps = _read(season, "player_season")
    ta = _read(season, "team_advanced")
    if pw is None or ps is None:
        log.warning("Insights için veri eksik")
        return
    reg = pw[pw["season_type"] == "REG"]
    last_week = int(reg["week"].max())

    hot, cold = form_trends(pw, last_week)
    usage = usage_shifts(pw, last_week)
    allowed = points_allowed(pw)
    games, next_season, next_week = upcoming_games(schedules, season)
    matchups = []
    power = []
    if ta is not None:
        power = team_power(ta)
        if not games.empty:
            matchups = matchup_notes(games, _ranks(ta), allowed, ps, season)

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "data_season": season,
        "through_week": last_week,
        "next_game_week": {"season": next_season, "week": next_week},
        "sections": {
            "hot": hot, "cold": cold, "usage": usage,
            "matchups": matchups, "team_power": power,
        },
    }
    path = config.DATA_DIR / "insights.json"
    with open(path, "w") as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
    n = sum(len(v) for v in payload["sections"].values())
    log.info("Insights yazıldı: %s madde (%s sezonu, hafta %s'e kadar)",
             n, season, last_week)
