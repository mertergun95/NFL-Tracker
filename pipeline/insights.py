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


# ------------------------------------------------------- şema çıkarımları

def scheme_insights(pscheme: pd.DataFrame | None,
                    tscheme: pd.DataFrame | None,
                    games: pd.DataFrame, ps: pd.DataFrame,
                    data_season: int) -> list:
    """QB'lerin blitze karşı performansı + blitz-ağır rakip eşleşmeleri."""
    out: list = []
    if pscheme is None or "split" not in getattr(pscheme, "columns", []):
        return out
    blitz = pscheme[(pscheme["unit"] == "QB") & (pscheme["split"] == "vs_blitz")
                    & (pscheme["plays"] >= 60)]
    if blitz.empty:
        return out
    for _, r in blitz.sort_values("epa_play", ascending=False).head(3).iterrows():
        out.append({
            "player_id": r["player_id"], "team": r["team"],
            "title": f"🧠 {r['player_name']} blitze karşı üretken",
            "detail": (f"Blitze karşı {int(r['plays'])} dropback'te EPA/play "
                       f"{r['epa_play']:+.2f} ({data_season}). Blitz-ağır "
                       f"savunmalara karşı avantaj."),
            "value": float(r["epa_play"]),
        })
    for _, r in blitz.sort_values("epa_play").head(3).iterrows():
        out.append({
            "player_id": r["player_id"], "team": r["team"],
            "title": f"⚠️ {r['player_name']} blitze karşı zorlanıyor",
            "detail": (f"Blitze karşı {int(r['plays'])} dropback'te EPA/play "
                       f"{r['epa_play']:+.2f} ({data_season})."),
            "value": float(r["epa_play"]),
        })
    # gelecek hafta: blitz-ağır rakip + QB blitz profili
    if tscheme is not None and not games.empty:
        bcol = "blitz_rate_ftn" if "blitz_rate_ftn" in tscheme.columns else "blitz_rate"
        if bcol in tscheme.columns:
            ts = tscheme.set_index("team")
            heavy = ts[ts[bcol] >= ts[bcol].quantile(0.8)].index
            qb_by_team = (ps[ps["position"] == "QB"]
                          .sort_values("attempts", ascending=False)
                          .drop_duplicates("team").set_index("team"))
            bq = blitz.set_index("player_id")
            for _, g in games.iterrows():
                for off, deff in ((g["away_team"], g["home_team"]),
                                  (g["home_team"], g["away_team"])):
                    if deff not in heavy or off not in qb_by_team.index:
                        continue
                    qb = qb_by_team.loc[off]
                    if qb["player_id"] not in bq.index:
                        continue
                    epa = float(bq.loc[qb["player_id"], "epa_play"])
                    rate = float(ts.loc[deff, bcol])
                    good = epa >= 0.1
                    if not good and epa > -0.05:
                        continue
                    out.append({
                        "player_id": qb["player_id"], "team": off,
                        "game": f"{g['away_team']} @ {g['home_team']}",
                        "title": (f"{'🧠' if good else '⚠️'} "
                                  f"{g['away_team']} @ {g['home_team']}: "
                                  f"{deff} blitz-ağır (%{rate*100:.0f})"),
                        "detail": (f"{qb['player_name']} blitze karşı EPA/play "
                                   f"{epa:+.2f} ({data_season}) — bu eşleşme "
                                   f"{'lehine' if good else 'aleyhine'}."),
                        "value": abs(epa),
                    })
    return out[:12]


# ------------------------------------------------------------ projeksiyon

PROJ_STAT = {"QB": "passing_yards", "RB": "rushing_yards",
             "WR": "receiving_yards", "TE": "receiving_yards"}


def build_projections(pw: pd.DataFrame, allowed: pd.DataFrame,
                      games: pd.DataFrame, next_season: int, next_week: int,
                      data_season: int) -> pd.DataFrame:
    """Basit haftalık projeksiyon: ağırlıklı form + rakip pozisyon-zafiyeti çarpanı."""
    if games.empty:
        return pd.DataFrame()
    opp = {}
    for _, g in games.iterrows():
        opp[g["home_team"]] = g["away_team"]
        opp[g["away_team"]] = g["home_team"]

    reg = pw[(pw["season_type"] == "REG") & pw["position"].isin(SKILL_POS)
             & pw["fantasy_points_ppr"].notna()].sort_values("week")
    league_avg = allowed.groupby("position")["ppr_allowed"].mean()

    rows = []
    for pid, g in reg.groupby("player_id"):
        if len(g) < 4:
            continue
        team = g["team"].iloc[-1]
        if team not in opp:
            continue
        pos = g["position"].iloc[-1]
        stat_col = PROJ_STAT.get(pos)
        last5 = g.tail(5)
        w = pd.Series(range(1, len(last5) + 1), index=last5.index, dtype=float)
        recent = float((last5["fantasy_points_ppr"] * w).sum() / w.sum())
        season_avg = float(g["fantasy_points_ppr"].mean())
        base = 0.6 * recent + 0.4 * season_avg
        opponent = opp[team]
        row_a = allowed[(allowed["team"] == opponent) & (allowed["position"] == pos)]
        factor = 1.0
        if not row_a.empty and pos in league_avg.index and league_avg[pos] > 0:
            factor = float(row_a["ppr_allowed"].iloc[0] / league_avg[pos])
            factor = max(0.8, min(1.25, factor))
        stat_proj = None
        if stat_col in g.columns:
            s_recent = float((last5[stat_col].fillna(0) * w).sum() / w.sum())
            s_season = float(g[stat_col].fillna(0).mean())
            stat_proj = round((0.6 * s_recent + 0.4 * s_season) * factor, 1)
        rows.append({
            "player_id": pid, "player_name": g["player_name"].iloc[-1],
            "position": pos, "team": team, "opponent": opponent,
            "proj_ppr": round(base * factor, 1),
            "recent_avg": round(recent, 1), "season_avg": round(season_avg, 1),
            "matchup_factor": round(factor, 2),
            "proj_stat": stat_proj, "proj_stat_name": stat_col,
        })
    df = pd.DataFrame(rows)
    if df.empty:
        return df
    df = df[df["proj_ppr"] >= 4].sort_values("proj_ppr", ascending=False)
    return df.reset_index(drop=True)


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
    scheme = scheme_insights(_read(season, "player_scheme"),
                             _read(season, "team_scheme"), games, ps, season)

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "data_season": season,
        "through_week": last_week,
        "next_game_week": {"season": next_season, "week": next_week},
        "sections": {
            "hot": hot, "cold": cold, "usage": usage,
            "matchups": matchups, "scheme": scheme, "team_power": power,
        },
    }
    path = config.DATA_DIR / "insights.json"
    with open(path, "w") as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
    n = sum(len(v) for v in payload["sections"].values())
    log.info("Insights yazıldı: %s madde (%s sezonu, hafta %s'e kadar)",
             n, season, last_week)

    # Haftalık projeksiyonlar (sıradaki oynanmamış hafta için)
    proj = build_projections(pw, allowed, games, next_season, next_week, season)
    if not proj.empty:
        payload_p = {
            "generated_at": payload["generated_at"],
            "data_season": season,
            "target": {"season": next_season, "week": next_week},
            "columns": list(proj.columns),
            "rows": proj.where(pd.notna(proj), None).values.tolist(),
        }
        with open(config.DATA_DIR / "projections.json", "w") as f:
            json.dump(payload_p, f, ensure_ascii=False, separators=(",", ":"))
        log.info("Projeksiyonlar yazıldı: %s oyuncu (%s W%s)",
                 len(proj), next_season, next_week)
