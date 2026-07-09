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

def form_trends(pw: pd.DataFrame, last_week: int,
                cur_map: dict | None = None) -> tuple[list, list]:
    cur_map = cur_map or {}
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

    def real_stats(pid: str, pos: str) -> str:
        """Gerçek istatistik karşılaştırması: son pencere vs sezon ortalaması."""
        cols = [c for c, _ in POS_STAT_LINES.get(pos, [])]
        cols = [c for c in cols if c in reg.columns]
        if not cols:
            return ""
        s = reg[reg["player_id"] == pid][cols].mean()
        w = window[window["player_id"] == pid][cols].mean()
        parts = [f"{w[c]:.1f}/{s[c]:.1f} {lbl}"
                 for c, lbl in POS_STAT_LINES.get(pos, []) if c in cols]
        return " Son 3 vs sezon: " + ", ".join(parts) + "."

    def items(rows, emoji):
        out = []
        for pid, r in rows.iterrows():
            team = cur_map.get(pid, r["team"])
            out.append({
                "player_id": pid, "team": team,
                "title": f"{emoji} {r['name']} ({r['pos']}, {team})",
                "detail": (f"Son {FORM_WINDOW} haftada {r['recent']:.1f} PPR/maç — "
                           f"sezon ortalaması {r['avg']:.1f} ({r['diff']:+.1f})."
                           + real_stats(pid, r["pos"])),
                "value": round(float(r["diff"]), 1),
            })
        return out

    hot = items(j[j["diff"] >= 4].sort_values("diff", ascending=False).head(8), "🔥")
    cold = items(j[j["diff"] <= -4].sort_values("diff").head(8), "🧊")
    return hot, cold


# ----------------------------------------------------------------- usage

def usage_shifts(pw: pd.DataFrame, last_week: int,
                 cur_map: dict | None = None) -> list:
    cur_map = cur_map or {}
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
            team = cur_map.get(pid, r["team"])
            out.append({
                "player_id": pid, "team": team,
                "title": f"📈 {r['name']} ({r['pos']}, {team})",
                "detail": (f"Son {FORM_WINDOW} haftada {label_tr} "
                           f"%{r['recent']*100:.0f} — sezon ortalaması "
                           f"%{r['avg']*100:.0f} (+{r['diff']*100:.0f} puan)."),
                "value": round(float(r["diff"]), 3),
            })
    return sorted(out, key=lambda x: -x["value"])[:10]


# ------------------------------------------------- pozisyona karşı verilen

ALLOWED_STATS = [
    "fantasy_points_ppr", "receptions", "receiving_yards", "receiving_tds",
    "carries", "rushing_yards", "rushing_tds",
    "passing_yards", "passing_tds", "passing_interceptions",
]


def points_allowed(pw: pd.DataFrame) -> pd.DataFrame:
    """Takım başına pozisyona verilen GERÇEK istatistikler (maç başı) ve lig sıraları.

    rank_* kolonlarında 1 = o istatistiği en çok veren (en cömert) savunma.
    """
    reg = pw[(pw["season_type"] == "REG") & pw["position"].isin(SKILL_POS)]
    stats = [c for c in ALLOWED_STATS if c in reg.columns]
    per_game = (reg.groupby(["opponent_team", "position", "week"])[stats]
                   .sum().reset_index())
    avg = (per_game.groupby(["opponent_team", "position"])[stats]
                   .mean().reset_index()
                   .rename(columns={"opponent_team": "team"}))
    for c in stats:
        asc = c == "passing_interceptions"  # int'te çok veren = az çalan değil; yine desc mantıklı
        avg[f"rank_{c}"] = avg.groupby("position")[c].rank(
            ascending=asc, method="min").astype(int)
    for c in stats:
        avg[c] = avg[c].round(2)
    # geriye dönük uyumluluk
    avg["ppr_allowed"] = avg["fantasy_points_ppr"]
    avg["rank"] = avg["rank_fantasy_points_ppr"]
    return avg


# pozisyona göre "gerçek stat" özet metni
POS_STAT_LINES = {
    "QB": [("passing_yards", "pas yd"), ("passing_tds", "pas TD"),
           ("passing_interceptions", "int")],
    "RB": [("rushing_yards", "koşu yd"), ("rushing_tds", "koşu TD"),
           ("receptions", "rec")],
    "WR": [("receptions", "rec"), ("receiving_yards", "rec yd"),
           ("receiving_tds", "rec TD")],
    "TE": [("receptions", "rec"), ("receiving_yards", "rec yd"),
           ("receiving_tds", "rec TD")],
}


def _stat_line(row, pos: str) -> str:
    parts = []
    for col, lbl in POS_STAT_LINES.get(pos, []):
        v = row.get(col)
        if v is None or pd.isna(v):
            continue
        parts.append(f"{float(v):.1f} {lbl}")
    return ", ".join(parts)


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
            # pozisyona karşı en cömert savunmalar (gerçek istatistiklerle)
            headline_rank = {"WR": "rank_receiving_yards", "TE": "rank_receiving_yards",
                             "RB": "rank_rushing_yards", "QB": "rank_passing_yards"}
            for pos in ("WR", "RB", "TE", "QB"):
                r = allowed[(allowed["team"] == deff) & (allowed["position"] == pos)]
                if r.empty:
                    continue
                row = r.iloc[0]
                hr_col = headline_rank[pos]
                rank = int(row.get(hr_col, row["rank"]))
                if rank <= 4:
                    players = top_players(off, pos) if pos != "QB" else ""
                    stat_txt = _stat_line(row, pos)
                    notes.append({
                        "team": off, "game": game_lbl,
                        "title": f"🎯 {game_lbl}: {deff}, {pos} pozisyonuna cömert",
                        "detail": (f"{deff} savunması {pos}'lara maç başına "
                                   f"{stat_txt} verdi (lig #{rank}, {data_season})."
                                   + (f" Takip et: {players}." if players else "")),
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
    # gelecek hafta: coverage şeması (man/zone) uyumu
    if tscheme is not None and not games.empty and "man_rate" in tscheme.columns:
        ts = tscheme.set_index("team")
        man_hi = ts["man_rate"].quantile(0.8)
        zone_hi = ts["zone_rate"].quantile(0.8)
        wrs = ps[ps["position"] == "WR"]
        for _, g in games.iterrows():
            for off, deff in ((g["away_team"], g["home_team"]),
                              (g["home_team"], g["away_team"])):
                if deff not in ts.index:
                    continue
                d = ts.loc[deff]
                for cov, rate_col, epa_col, lbl in (
                    ("man", "man_rate", "epa_vs_man", "man (adam adama)"),
                    ("zone", "zone_rate", "epa_vs_zone", "zone (alan)"),
                ):
                    rate = d.get(rate_col)
                    if rate is None or pd.isna(rate):
                        continue
                    if (cov == "man" and rate < man_hi) or (cov == "zone" and rate < zone_hi):
                        continue
                    epa = d.get(epa_col)
                    if epa is None or pd.isna(epa):
                        continue
                    weak = epa > ts[epa_col].quantile(0.7)   # coverage'ında çok EPA veriyor
                    strong = epa < ts[epa_col].quantile(0.3)
                    if not (weak or strong):
                        continue
                    top_wr = (wrs[wrs["team"] == off]
                              .sort_values("receiving_yards", ascending=False)
                              .head(2)["player_name"].tolist())
                    out.append({
                        "team": off, "game": f"{g['away_team']} @ {g['home_team']}",
                        "title": (f"{'🎯' if weak else '🛡️'} "
                                  f"{g['away_team']} @ {g['home_team']}: {deff} "
                                  f"%{rate*100:.0f} {lbl} oynuyor"),
                        "detail": (f"{deff} bu coverage'da EPA/play {epa:+.2f} "
                                   f"({'lig ortalamasının üstünde yol veriyor' if weak else 'ligin en sıkılarından'}, "
                                   f"{data_season})."
                                   + (f" {off} tarafında izle: {', '.join(top_wr)}."
                                      if top_wr else "")),
                        "value": float(abs(epa)) + 0.5,
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

# Pozisyona göre tahmin edilecek GERÇEK istatistikler
POS_PROJ_STATS = {
    "QB": ["attempts", "completions", "passing_yards", "passing_tds",
           "passing_interceptions", "carries", "rushing_yards"],
    "RB": ["carries", "rushing_yards", "rushing_tds", "targets",
           "receptions", "receiving_yards"],
    "WR": ["targets", "receptions", "receiving_yards", "receiving_tds"],
    "TE": ["targets", "receptions", "receiving_yards", "receiving_tds"],
}
# matchup çarpanı için stat -> pos_allowed kolonu (yoksa vekil)
FACTOR_PROXY = {"attempts": "passing_yards", "completions": "passing_yards"}
# pozisyonun birincil stati (sıralama/karne için)
POS_PRIMARY = {"QB": "passing_yards", "RB": "rushing_yards",
               "WR": "receiving_yards", "TE": "receiving_yards"}


def current_team_map() -> dict:
    """Güncel kadro eşlemesi: player_id -> takım (roster+depth birleşik dosyadan)."""
    for name in ("current_teams.json", "depth_charts.json"):
        df = transform.read_json(config.DATA_DIR / name)
        if df is not None and "player_id" in df.columns:
            df = df[df["player_id"].notna()].drop_duplicates("player_id")
            return dict(zip(df["player_id"], df["team"]))
    return {}


def injury_map(target_season: int) -> dict:
    """En güncel sakatlık durumu: player_id -> (status, sakatlık). Yalnızca
    rapor hedef sezona aitse uygulanır (geçen sezonun raporu bayattır)."""
    inj = transform.read_json(config.DATA_DIR / "injuries.json")
    if inj is None or inj.empty or "player_id" not in inj.columns:
        return {}
    if "season" in inj.columns and int(inj["season"].max()) != target_season:
        return {}
    if "week" in inj.columns:
        inj = inj[inj["week"] == inj["week"].max()]
    inj = inj.drop_duplicates("player_id", keep="last")
    out = {}
    for _, r in inj.iterrows():
        status = r.get("report_status")
        if status and not pd.isna(status):
            out[r["player_id"]] = (str(status), str(r.get("report_primary_injury") or ""))
    return out


def _scheme_context(data_season: int):
    ps_scheme = _read(data_season, "player_scheme")
    ts = _read(data_season, "team_scheme")
    snaps = _read(data_season, "snap_counts")
    return ps_scheme, ts, snaps


def _split_epa(pscheme, pid, unit, split):
    if pscheme is None:
        return None
    r = pscheme[(pscheme["player_id"] == pid) & (pscheme["unit"] == unit)
                & (pscheme["split"] == split)]
    return float(r["epa_play"].iloc[0]) if not r.empty else None


def _clamp(v, lo, hi):
    return max(lo, min(hi, v))


def build_projections(pw: pd.DataFrame, allowed: pd.DataFrame,
                      games: pd.DataFrame, next_season: int, next_week: int,
                      data_season: int, use_current: bool = True,
                      apply_injuries: bool = True) -> pd.DataFrame:
    """Projeksiyon v3: pozisyona göre GERÇEK istatistik tahminleri.

    Her stat için: (son 5 maçın ağırlıklı formu ×0.6 + sezon ort. ×0.4)
    × o statın kendi matchup çarpanı (rakibin o pozisyona o statta verdiği
    / lig ort.) × şema uyumu × snap trendi × sakatlık.
    use_current/apply_injuries=False geriye dönük test (karne) için kullanılır.
    """
    if games.empty:
        return pd.DataFrame()
    opp = {}
    for _, g in games.iterrows():
        opp[g["home_team"]] = g["away_team"]
        opp[g["away_team"]] = g["home_team"]

    cur_map = current_team_map() if use_current else {}
    injuries = injury_map(next_season) if apply_injuries else {}
    pscheme, tscheme, snaps = _scheme_context(data_season)
    ts = tscheme.set_index("team") if tscheme is not None else None
    blitz_col = None
    if ts is not None:
        blitz_col = "blitz_rate_ftn" if "blitz_rate_ftn" in ts.columns else (
            "blitz_rate" if "blitz_rate" in ts.columns else None)

    reg = pw[(pw["season_type"] == "REG") & pw["position"].isin(SKILL_POS)
             & pw["fantasy_points_ppr"].notna()].sort_values("week")
    league_avg = allowed.groupby("position")["ppr_allowed"].mean()
    # stat bazlı lig ortalamaları: pozisyon -> stat -> maç başı ortalama
    stat_league = allowed.groupby("position")[
        [c for c in ALLOWED_STATS if c in allowed.columns]].mean()

    # snap trendi: oyuncu başına son3/sezon hücum snap payı oranı
    snap_ratio: dict = {}
    if snaps is not None and "offense_pct" in snaps.columns:
        sreg = snaps[(snaps.get("game_type") == "REG")
                     & snaps["player_id"].notna()].sort_values("week")
        for pid, g in sreg.groupby("player_id"):
            season_m = g["offense_pct"].mean()
            if season_m and season_m >= 0.25:
                snap_ratio[pid] = _clamp(
                    float(g["offense_pct"].tail(3).mean() / season_m), 0.85, 1.15)

    rows = []
    for pid, g in reg.groupby("player_id"):
        if len(g) < 4:
            continue
        pos = g["position"].iloc[-1]
        if use_current and cur_map:
            # SIKI mod: güncel kadroda olmayan oyuncu (free agent / emekli /
            # takımsız) projeksiyona girmez — eski takımında "varmış gibi"
            # görünmesin (ör. transfer olan/ayrılan oyuncular)
            team = cur_map.get(pid)
            if team is None:
                continue
        else:
            team = g["team"].iloc[-1]
        if team not in opp:
            continue
        opponent = opp[team]

        injury_status, injury_note = injuries.get(pid, (None, None))
        if injury_status in ("Out", "Doubtful"):
            continue  # oynamayacak — Sakatlıklar sayfasında görünür

        last5 = g.tail(5)
        w = pd.Series(range(1, len(last5) + 1), index=last5.index, dtype=float)
        recent = float((last5["fantasy_points_ppr"] * w).sum() / w.sum())
        season_avg = float(g["fantasy_points_ppr"].mean())
        base = 0.6 * recent + 0.4 * season_avg

        # 1) matchup: genel (PPR bazlı, sıralama için) + stat bazlı çarpanlar
        row_a = allowed[(allowed["team"] == opponent) & (allowed["position"] == pos)]
        matchup = 1.0
        if not row_a.empty and pos in league_avg.index and league_avg[pos] > 0:
            matchup = _clamp(float(row_a["ppr_allowed"].iloc[0] / league_avg[pos]),
                             0.8, 1.25)

        def stat_factor(stat: str) -> float:
            src = FACTOR_PROXY.get(stat, stat)
            if (row_a.empty or src not in allowed.columns
                    or pos not in stat_league.index):
                return matchup
            lg = stat_league.loc[pos].get(src)
            if lg is None or pd.isna(lg) or lg <= 0:
                return matchup
            v = row_a[src].iloc[0]
            if v is None or pd.isna(v):
                return matchup
            return _clamp(float(v / lg), 0.75, 1.3)

        # 2) şema uyumu
        scheme_f = 1.0
        if ts is not None and opponent in ts.index:
            d = ts.loc[opponent]
            if pos == "QB" and blitz_col and not pd.isna(d.get(blitz_col)):
                if d[blitz_col] >= ts[blitz_col].quantile(0.75):
                    e_b = _split_epa(pscheme, pid, "QB", "vs_blitz")
                    e_n = _split_epa(pscheme, pid, "QB", "no_blitz")
                    if e_b is not None and e_n is not None:
                        scheme_f *= _clamp(1 + (e_b - e_n) * 0.25, 0.92, 1.08)
            if pos == "RB" and "avg_box" in ts.columns and not pd.isna(d.get("avg_box")):
                if d["avg_box"] >= ts["avg_box"].quantile(0.75):
                    e_h = _split_epa(pscheme, pid, "RUSH", "heavy_box")
                    e_l = _split_epa(pscheme, pid, "RUSH", "light_box")
                    if e_h is not None and e_l is not None:
                        scheme_f *= _clamp(1 + (e_h - e_l) * 0.25, 0.92, 1.08)
            if pos in ("WR", "TE") and "man_rate" in ts.columns:
                for rate_col, epa_col in (("man_rate", "epa_vs_man"),
                                          ("zone_rate", "epa_vs_zone")):
                    r_v, e_v = d.get(rate_col), d.get(epa_col)
                    if (r_v is not None and not pd.isna(r_v)
                            and r_v >= ts[rate_col].quantile(0.75)
                            and e_v is not None and not pd.isna(e_v)):
                        mean_e = ts[epa_col].mean()
                        scheme_f *= _clamp(1 + (e_v - mean_e) * 0.3, 0.94, 1.06)

        # 3) snap trendi (fırsat) — QB'de snap payı bilgi taşımaz (W18 rotasyonu
        # yanıltır), yalnızca top taşıyıcı/yakalayıcılarda uygula
        snap_f = snap_ratio.get(pid, 1.0) if pos != "QB" else 1.0

        # 4) sakatlık kırpması
        inj_f = 0.9 if injury_status == "Questionable" else 1.0

        common_f = scheme_f * snap_f * inj_f

        # GERÇEK istatistik projeksiyonları (pozisyona göre)
        row = {
            "player_id": pid, "player_name": g["player_name"].iloc[-1],
            "position": pos, "team": team, "opponent": opponent,
            "proj_ppr": round(base * matchup * common_f, 1),  # sıralama/karne referansı
            "recent_avg": round(recent, 1), "season_avg": round(season_avg, 1),
            "matchup_factor": round(matchup, 2),
            "scheme_factor": round(scheme_f, 2),
            "snap_factor": round(snap_f, 2),
            "injury_status": injury_status,
            "injury_note": injury_note,
        }
        for stat in POS_PROJ_STATS.get(pos, []):
            if stat not in g.columns:
                continue
            s_recent = float((last5[stat].fillna(0) * w).sum() / w.sum())
            s_season = float(g[stat].fillna(0).mean())
            val = (0.6 * s_recent + 0.4 * s_season) * stat_factor(stat) * common_f
            row[f"proj_{stat}"] = round(val, 1)
        rows.append(row)

    df = pd.DataFrame(rows)
    if df.empty:
        return df
    df = df[df["proj_ppr"] >= 4].sort_values("proj_ppr", ascending=False)
    return df.reset_index(drop=True)


# -------------------------------------------------- projeksiyon karnesi

EVAL_WEEKS = 4


def evaluate_projections(pw: pd.DataFrame, schedules: pd.DataFrame,
                         data_season: int) -> None:
    """Geriye dönük test: son N tamamlanmış haftayı, yalnızca ÖNCEKİ haftaların
    verisiyle projekte edip gerçekleşenlerle karşılaştırır. Sezon içinde her
    Salı kendini günceller — projeksiyon tutarlılığının karnesi.
    """
    reg = pw[pw["season_type"] == "REG"]
    last_week = int(reg["week"].max())
    weeks = [w for w in range(max(6, last_week - EVAL_WEEKS + 1), last_week + 1)]

    all_stats = sorted({s for lst in POS_PROJ_STATS.values() for s in lst})
    week_summaries = []
    players_latest: list[dict] = []

    for wk in weeks:
        cut = pw[(pw["season_type"] == "REG") & (pw["week"] < wk)]
        if cut.empty:
            continue
        games_w = schedules[(schedules["season"] == data_season)
                            & (schedules["game_type"] == "REG")
                            & (schedules["week"] == wk)]
        if games_w.empty:
            continue
        proj = build_projections(cut, points_allowed(cut), games_w,
                                 data_season, wk, data_season,
                                 use_current=False, apply_injuries=False)
        if proj.empty:
            continue
        actual = reg[reg["week"] == wk]
        j = proj.merge(actual, on="player_id", how="inner",
                       suffixes=("", "_act"))
        if j.empty:
            continue

        stat_metrics = {}
        for stat in all_stats:
            pc, ac = f"proj_{stat}", stat
            if pc not in j.columns or ac not in j.columns:
                continue
            sub = j[j[pc].notna() & j[ac].notna()]
            if len(sub) < 10:
                continue
            diff = sub[pc] - sub[ac]
            corr = float(sub[pc].corr(sub[ac])) if len(sub) > 2 else None
            stat_metrics[stat] = {
                "n": int(len(sub)),
                "mae": round(float(diff.abs().mean()), 2),
                "bias": round(float(diff.mean()), 2),
                "corr": round(corr, 3) if corr is not None and not pd.isna(corr) else None,
            }
        week_summaries.append({"week": wk, "n": int(len(j)), "stats": stat_metrics})

        if wk == weeks[-1]:
            keep_cols = ["player_id", "player_name", "position", "team",
                         "opponent", "proj_ppr"]
            for stat in all_stats:
                if f"proj_{stat}" in j.columns:
                    keep_cols += [f"proj_{stat}"]
            detail = j[[c for c in keep_cols if c in j.columns]].copy()
            for stat in all_stats:
                if stat in j.columns:
                    detail[f"act_{stat}"] = j[stat]
            detail["week"] = wk
            # float kolonlarda None NaN'a geri döner; object'e çevirerek koru
            detail = detail.astype(object).where(pd.notna(detail), None)
            players_latest = detail.to_dict("records")

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "data_season": data_season,
        "method": ("Her hafta yalnızca öncesindeki haftaların verisiyle projekte "
                   "edilip gerçek sonuçlarla karşılaştırıldı (güncel kadro ve "
                   "sakatlık düzeltmeleri geriye dönük testte kapalı)."),
        "weeks": week_summaries,
        "players": players_latest,
    }
    with open(config.DATA_DIR / "proj_eval.json", "w") as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"),
                  allow_nan=False)
    log.info("Projeksiyon karnesi yazıldı: %s hafta, son hafta %s oyuncu",
             len(week_summaries), len(players_latest))


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

    # Güncel kadro eşlemesi: matchup/insight'larda oyuncular YENİ takımlarıyla anılır
    cur_map = current_team_map()
    ps_cur = ps.copy()
    if cur_map:
        ps_cur["team"] = ps_cur["player_id"].map(cur_map).fillna(ps_cur["team"])

    hot, cold = form_trends(pw, last_week, cur_map)
    usage = usage_shifts(pw, last_week, cur_map)
    allowed = points_allowed(pw)
    games, next_season, next_week = upcoming_games(schedules, season)
    matchups = []
    power = []
    if ta is not None:
        power = team_power(ta)
        if not games.empty:
            matchups = matchup_notes(games, _ranks(ta), allowed, ps_cur, season)
    scheme = scheme_insights(_read(season, "player_scheme"),
                             _read(season, "team_scheme"), games, ps_cur, season)

    # Matchup sayfası ve dış kullanım için yardımcı dosyalar
    transform.write_json(config.DATA_DIR / "pos_allowed.json", allowed)
    next_sched = transform.build_schedule(schedules, next_season)
    if not next_sched.empty:
        transform.write_json(config.DATA_DIR / "next_schedule.json", next_sched)

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
        proj_safe = proj.astype(object).where(pd.notna(proj), None)
        payload_p = {
            "generated_at": payload["generated_at"],
            "data_season": season,
            "target": {"season": next_season, "week": next_week},
            "columns": list(proj.columns),
            "rows": proj_safe.values.tolist(),
        }
        with open(config.DATA_DIR / "projections.json", "w") as f:
            json.dump(payload_p, f, ensure_ascii=False, separators=(",", ":"),
                      allow_nan=False)
        log.info("Projeksiyonlar yazıldı: %s oyuncu (%s W%s)",
                 len(proj), next_season, next_week)

    # Projeksiyon karnesi (geriye dönük test)
    try:
        evaluate_projections(pw, schedules, season)
    except Exception:
        log.exception("Projeksiyon karnesi üretilemedi")
