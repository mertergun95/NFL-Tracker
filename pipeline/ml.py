"""ML projeksiyon motoru: gradient boosting ile gerçek stat tahminleri.

İşlenmiş sezon dosyalarındaki (seasons/*/player_weeks.json) tüm tarihi
kullanarak stat başına birer HistGradientBoostingRegressor eğitir.
Özellikler yalnızca hedef haftadan ÖNCEKİ bilgiden türetilir (sızıntı yok):
- oyuncunun sezon-içi kümülatif ve son-3-maç ortalamaları (hacim + üretim)
- önceki sezonun maç başı ortalamaları (sezon başı soğuk-başlangıcı çözer)
- rakibin o pozisyona o statta sezon-içi verdiği (maç başı)
- ev/deplasman, hafta numarası, pozisyon, o sezonki maç sayısı
"""
import logging

import numpy as np
import pandas as pd

import config
import transform

log = logging.getLogger(__name__)

SKILL_POS = ["QB", "RB", "WR", "TE"]

# hem özellik (geçmiş ort.) hem hedef olarak kullanılan statlar
STATS = ["targets", "receptions", "receiving_yards", "receiving_tds",
         "carries", "rushing_yards", "rushing_tds",
         "attempts", "completions", "passing_yards", "passing_tds",
         "passing_interceptions", "fantasy_points_ppr"]

# tahmin edilen hedefler (fantasy hariç — o türetilir)
TARGETS = [s for s in STATS if s != "fantasy_points_ppr"]

# rakip-zafiyeti özelliği eklenecek statlar
OPP_STATS = ["receptions", "receiving_yards", "receiving_tds",
             "carries", "rushing_yards", "rushing_tds",
             "passing_yards", "passing_tds"]


def load_all_weeks() -> pd.DataFrame:
    """Repo'daki tüm işlenmiş sezonların REG oyuncu-haftaları."""
    frames = []
    for sdir in sorted((config.DATA_DIR / "seasons").glob("*")):
        pw = transform.read_json(sdir / "player_weeks.json")
        if pw is not None:
            frames.append(pw)
    if not frames:
        return pd.DataFrame()
    df = pd.concat(frames, ignore_index=True)
    df = df[(df["season_type"] == "REG") & df["position"].isin(SKILL_POS)]
    for s in STATS:
        if s not in df.columns:
            df[s] = 0.0
        df[s] = pd.to_numeric(df[s], errors="coerce").fillna(0.0)
    return df.sort_values(["player_id", "season", "week"]).reset_index(drop=True)


def _home_map(schedules: pd.DataFrame) -> set:
    reg = schedules[schedules["game_type"] == "REG"]
    return {(int(r.season), int(r.week), str(r.home_team))
            for r in reg.itertuples()}


def build_features(df: pd.DataFrame, schedules: pd.DataFrame) -> pd.DataFrame:
    """Her oyuncu-hafta satırı için sızıntısız özellik seti (hedefler dahil)."""
    df = df.copy()
    g = df.groupby(["player_id", "season"], sort=False)

    feats = {}
    for s in STATS:
        shifted = g[s].shift(1)
        feats[f"szn_{s}"] = shifted.groupby(
            [df["player_id"], df["season"]]).expanding().mean().reset_index(
            level=[0, 1], drop=True)
        feats[f"l3_{s}"] = shifted.groupby(
            [df["player_id"], df["season"]]).rolling(3, min_periods=1).mean(
            ).reset_index(level=[0, 1], drop=True)
    feats["games_so_far"] = g.cumcount()

    # önceki sezon maç başı ortalamaları
    prev = (df.groupby(["player_id", "season"])[STATS].mean()
              .reset_index())
    prev["season"] += 1
    prev = prev.rename(columns={s: f"prev_{s}" for s in STATS})
    df = df.merge(prev, on=["player_id", "season"], how="left")

    # rakibin pozisyona o statta sezon-içi verdiği (maç başı, hedef hafta hariç)
    allowed = (df.groupby(["opponent_team", "position", "season", "week"])
                 [OPP_STATS].sum().reset_index()
                 .sort_values("week"))
    ag = allowed.groupby(["opponent_team", "position", "season"], sort=False)
    for s in OPP_STATS:
        allowed[f"opp_{s}"] = (ag[s].shift(1).groupby(
            [allowed["opponent_team"], allowed["position"], allowed["season"]])
            .expanding().mean().reset_index(level=[0, 1, 2], drop=True))
    df = df.merge(
        allowed[["opponent_team", "position", "season", "week"]
                + [f"opp_{s}" for s in OPP_STATS]],
        on=["opponent_team", "position", "season", "week"], how="left")

    for k, v in feats.items():
        df[k] = v.values if hasattr(v, "values") else v

    homes = _home_map(schedules)
    df["is_home"] = [(int(r.season), int(r.week), str(r.team)) in homes
                     for r in df.itertuples()]
    for p in SKILL_POS:
        df[f"pos_{p}"] = (df["position"] == p).astype(int)
    return df


FEATURE_COLS = (
    [f"szn_{s}" for s in STATS] + [f"l3_{s}" for s in STATS]
    + [f"prev_{s}" for s in STATS] + [f"opp_{s}" for s in OPP_STATS]
    + ["games_so_far", "week", "is_home"]
    + [f"pos_{p}" for p in SKILL_POS]
)


def train_models(feat_df: pd.DataFrame,
                 max_season: int, max_week: int | None = None) -> dict:
    """(max_season, max_week) ÖNCESİ satırlarla stat başına model eğitir."""
    from sklearn.ensemble import HistGradientBoostingRegressor

    mask = (feat_df["season"] < max_season) | (
        (feat_df["season"] == max_season)
        & (feat_df["week"] < (max_week or 99)))
    # geçmişi hiç olmayan satırları at (hem sezon-içi hem önceki sezon boş)
    has_hist = feat_df["szn_fantasy_points_ppr"].notna() | \
        feat_df["prev_fantasy_points_ppr"].notna()
    train = feat_df[mask & has_hist]
    if len(train) < 2000:
        log.warning("ML eğitimi için yetersiz veri: %s satır", len(train))
        return {}
    X = train[FEATURE_COLS].astype(float)
    models = {}
    for t in TARGETS:
        m = HistGradientBoostingRegressor(
            max_iter=220, learning_rate=0.06, max_depth=None,
            max_leaf_nodes=31, min_samples_leaf=40,
            l2_regularization=1.0, random_state=42)
        m.fit(X, train[t].astype(float))
        models[t] = m
    log.info("ML modelleri eğitildi: %s hedef, %s satır", len(models), len(train))
    return models


def predict(models: dict, rows: pd.DataFrame) -> pd.DataFrame:
    """Özellikleri hazır satırlar için tüm hedef statları tahmin eder."""
    X = rows[FEATURE_COLS].astype(float)
    out = rows[["player_id"]].copy()
    for t, m in models.items():
        out[f"proj_{t}"] = np.clip(m.predict(X), 0, None).round(1)
    return out


def inference_rows(history: pd.DataFrame, schedules: pd.DataFrame,
                   games: pd.DataFrame, target_season: int, target_week: int,
                   team_of: dict | None = None) -> pd.DataFrame:
    """Hedef hafta için oyuncu başına özellik satırları üretir.

    history: hedef haftadan önceki tüm oyuncu-haftalar.
    team_of: player_id -> güncel takım (verilirse kadro buradan alınır).
    """
    opp = {}
    for _, gm in games.iterrows():
        opp[gm["home_team"]] = gm["away_team"]
        opp[gm["away_team"]] = gm["home_team"]

    # sahte hedef satırları ekleyip aynı özellik akışından geçir
    last = history.sort_values(["season", "week"]).groupby("player_id").last()
    cands = []
    for pid, r in last.iterrows():
        if team_of is not None:
            # SIKI güncel kadro modu: haritada olmayan oyuncu (FA/emekli) girmez
            team = team_of.get(pid)
            if team is None:
                continue
        else:
            team = r["team"]
        if team not in opp:
            continue
        cands.append({
            "player_id": pid, "player_name": r["player_name"],
            "position": r["position"], "team": team,
            "opponent_team": opp[team],
            "season": target_season, "week": target_week,
            "season_type": "REG",
            **{s: 0.0 for s in STATS},
        })
    if not cands:
        return pd.DataFrame()
    stub = pd.DataFrame(cands)
    combined = pd.concat([history, stub], ignore_index=True)
    combined = combined.sort_values(["player_id", "season", "week"])
    feat = build_features(combined, schedules)
    out = feat[(feat["season"] == target_season)
               & (feat["week"] == target_week)].copy()
    return out.rename(columns={"opponent_team": "opponent"})
