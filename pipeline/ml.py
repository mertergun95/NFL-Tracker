"""ML projeksiyon motoru: gradient boosting ile gerçek stat tahminleri.

İşlenmiş sezon dosyalarındaki (seasons/*/player_weeks.json) tüm tarihi
kullanarak stat başına birer HistGradientBoostingRegressor eğitir.
Özellikler yalnızca hedef haftadan ÖNCEKİ bilgiden türetilir (sızıntı yok):
- oyuncunun sezon-içi kümülatif ve son-3-maç ortalamaları (hacim + üretim)
- oyuncunun kullanım/verimlilik oranları (target share, air yards share,
  carry share, EPA/play) — ham hacimden bağımsız, asıl "fırsat" sinyali
- önceki sezonun maç başı ortalamaları (sezon başı soğuk-başlangıcı çözer)
- rakibin o pozisyona o statta sezon-içi verdiği (maç başı)
- takım skor bağlamı: kendi takımının ve rakibin sezon-içi maç başı
  attığı/yediği sayı (gerçek Vegas hattı yerine geçen ücretsiz proxy —
  maç temposu/shootout potansiyelini yakalar, özellikle TD ve pas
  hacminde ham "rakibe verilen yard" özelliklerinden daha güçlü sinyal)
- ev/deplasman, hafta numarası, pozisyon, o sezonki maç sayısı

Not (18. tur — projeksiyon kalitesi araştırması): geriye dönük test
(proj_eval.json) tahmin/gerçek varyans oranını doğruluk korelasyonuna
(r) çok yakın gösteriyordu — yani "her oyuncu ortalamaya yakınsıyor"
şikâyeti aşırı regularizasyondan değil, düşük açıklayıcı güçten (zayıf
özellik seti) kaynaklanıyordu; bu en belirgin TD ve pas hacminde
görülüyordu (r≈0.15-0.30). Literatür (bkz. Tweedie/Poisson loss ile
overdispersed count-data çalışmaları) sayım-tipi hedeflerde kare-hata
yerine Poisson loss önerir; bu dosyada hem yeni özellik grupları hem
de hedefe göre loss seçimi eklendi.
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

# sayım-tipi hedefler: Poisson loss (kare-hata düz hacim/pas-yardı statları
# için kalır — bunlar sürekli/skewed ama "sayım" değil)
COUNT_TARGETS = {"targets", "receptions", "carries", "attempts", "completions",
                 "passing_tds", "rushing_tds", "receiving_tds",
                 "passing_interceptions"}

# yalnızca ÖZELLİK olarak kullanılan kullanım/verimlilik oranları — hedef
# DEĞİL. Ham hacimden (targets, carries...) bağımsız "fırsat kalitesi"
# sinyali taşırlar, bu yüzden zayıf-korelasyonlu statlarda (TD, pas)
# açıklayıcı gücü belirgin artırırlar.
AUX_STATS = ["target_share", "air_yards_share", "carry_share",
            "passing_epa", "rushing_epa", "receiving_epa"]

# rakip-zafiyeti özelliği eklenecek statlar
OPP_STATS = ["receptions", "receiving_yards", "receiving_tds",
             "carries", "rushing_yards", "rushing_tds",
             "passing_yards", "passing_tds"]

# Bir statı gerçekten üreten pozisyonlar — quantile (taban/tavan) eğitimi
# için kritik: TÜM pozisyonlar havuzlanınca (ör. receiving_yards'ta QB/RB
# gibi düşük-hacimli satırlar WR'lerden kat kat fazla), p20 tahmini gerçek
# WR1 taban değerine değil, düşük-hacimli çoğunluğa yakınsıyordu (ör. Rashee
# Rice taban=0 çıkıyordu; oysa gerçek veri: sezon 60+ yd/maç ortalamalı
# WR'lerin p20'si ~39 yd). Yalnızca ilgili pozisyonlarla eğitince taban
# 38.8'e çıktı — doğrulandı. Nokta tahmini (kare-hata/Poisson) etkilenmedi,
# bu yüzden yalnızca quantile modellerinde uygulanıyor.
STAT_POSITIONS = {
    "attempts": ["QB"], "completions": ["QB"], "passing_yards": ["QB"],
    "passing_tds": ["QB"], "passing_interceptions": ["QB"],
    "carries": ["QB", "RB"], "rushing_yards": ["QB", "RB"],
    "rushing_tds": ["QB", "RB"],
    "targets": ["RB", "WR", "TE"], "receptions": ["RB", "WR", "TE"],
    "receiving_yards": ["RB", "WR", "TE"], "receiving_tds": ["RB", "WR", "TE"],
}


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
    for s in AUX_STATS:
        # 0 ile doldurulmaz: gerçekten "yok" (ör. eski sezonda kolon yok)
        # ile "gerçekten sıfır pay" farklı şeyler — HGBR eksik değeri
        # doğal olarak işleyebiliyor, yanlış sinyal vermektense NaN bırak.
        if s not in df.columns:
            df[s] = np.nan
        df[s] = pd.to_numeric(df[s], errors="coerce")
    return df.sort_values(["player_id", "season", "week"]).reset_index(drop=True)


def _home_map(schedules: pd.DataFrame) -> set:
    reg = schedules[schedules["game_type"] == "REG"]
    return {(int(r.season), int(r.week), str(r.home_team))
            for r in reg.itertuples()}


def _team_game_log(schedules: pd.DataFrame) -> pd.DataFrame:
    """Her maç için iki satır (ev/deplasman) — takım bazlı skor günlüğü."""
    reg = schedules[schedules["game_type"] == "REG"].copy()
    home = reg[["season", "week", "home_team", "home_score", "away_score"]].rename(
        columns={"home_team": "team", "home_score": "points_for",
                 "away_score": "points_against"})
    away = reg[["season", "week", "away_team", "away_score", "home_score"]].rename(
        columns={"away_team": "team", "away_score": "points_for",
                 "home_score": "points_against"})
    tg = pd.concat([home, away], ignore_index=True)
    tg["points_for"] = pd.to_numeric(tg["points_for"], errors="coerce")
    tg["points_against"] = pd.to_numeric(tg["points_against"], errors="coerce")
    tg = tg.dropna(subset=["points_for", "points_against"])
    return tg.sort_values(["team", "season", "week"])


def _scoring_context(schedules: pd.DataFrame) -> pd.DataFrame:
    """Takım-hafta bazlı sızıntısız skor bağlamı: o haftadan ÖNCEKİ
    maçların sezon-içi maç başı averajı. Gerçek Vegas hattı yerine geçen
    ücretsiz bir proxy — maç temposu/shootout potansiyelini yakalar."""
    tg = _team_game_log(schedules)
    if tg.empty:
        return pd.DataFrame(columns=["team", "season", "week",
                                     "team_ppg", "team_pa_ppg"])
    g = tg.groupby(["team", "season"], sort=False)
    tg["team_ppg"] = g["points_for"].shift(1).groupby(
        [tg["team"], tg["season"]]).expanding().mean().reset_index(
        level=[0, 1], drop=True)
    tg["team_pa_ppg"] = g["points_against"].shift(1).groupby(
        [tg["team"], tg["season"]]).expanding().mean().reset_index(
        level=[0, 1], drop=True)
    return tg[["team", "season", "week", "team_ppg", "team_pa_ppg"]]


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
    for s in AUX_STATS:
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

    # sezon başı "soğuk başlangıç": bu sezon henüz maç oynanmadıysa (szn_/l3_
    # NaN) geçen sezonun maç başı ortalamasına düş. Bu satırlar tüm eğitim
    # verisinin ~%7'si (her oyuncunun her sezonun ilk maçı) ve NaN bırakınca
    # quantile (p20/p80) modelleri bu alt kümede sabit 0 tahmin etmeye
    # yakınsıyordu (kare-hata/Poisson etkilenmiyordu) — doğrulandı.
    for s in STATS:
        df[f"szn_{s}"] = df[f"szn_{s}"].fillna(df[f"prev_{s}"])
        df[f"l3_{s}"] = df[f"l3_{s}"].fillna(df[f"prev_{s}"])

    # takım skor bağlamı: kendi takımın hücum gücü + rakibin savunma
    # zafiyeti + rakibin kendi hücum gücü (tempo/shootout proxy'si)
    sc = _scoring_context(schedules)
    if not sc.empty:
        df = df.merge(sc, on=["team", "season", "week"], how="left")
        opp_sc = sc.rename(columns={"team": "opponent_team",
                                    "team_ppg": "opp_pf_ppg",
                                    "team_pa_ppg": "opp_pa_ppg"})
        df = df.merge(
            opp_sc[["opponent_team", "season", "week",
                    "opp_pf_ppg", "opp_pa_ppg"]],
            on=["opponent_team", "season", "week"], how="left")
    else:
        for c in ("team_ppg", "team_pa_ppg", "opp_pf_ppg", "opp_pa_ppg"):
            df[c] = np.nan

    homes = _home_map(schedules)
    df["is_home"] = [(int(r.season), int(r.week), str(r.team)) in homes
                     for r in df.itertuples()]
    for p in SKILL_POS:
        df[f"pos_{p}"] = (df["position"] == p).astype(int)
    return df


FEATURE_COLS = (
    [f"szn_{s}" for s in STATS] + [f"l3_{s}" for s in STATS]
    + [f"szn_{s}" for s in AUX_STATS] + [f"l3_{s}" for s in AUX_STATS]
    + [f"prev_{s}" for s in STATS] + [f"opp_{s}" for s in OPP_STATS]
    + ["team_ppg", "opp_pf_ppg", "opp_pa_ppg"]
    + ["games_so_far", "week", "is_home"]
    + [f"pos_{p}" for p in SKILL_POS]
)


def _train_split(feat_df: pd.DataFrame, max_season: int,
                 max_week: int | None) -> pd.DataFrame | None:
    """(max_season, max_week) ÖNCESİ, geçmişi olan satırlar. Yetersizse None."""
    mask = (feat_df["season"] < max_season) | (
        (feat_df["season"] == max_season)
        & (feat_df["week"] < (max_week or 99)))
    # geçmişi hiç olmayan satırları at (hem sezon-içi hem önceki sezon boş)
    has_hist = feat_df["szn_fantasy_points_ppr"].notna() | \
        feat_df["prev_fantasy_points_ppr"].notna()
    train = feat_df[mask & has_hist]
    if len(train) < 2000:
        log.warning("ML eğitimi için yetersiz veri: %s satır", len(train))
        return None
    return train


def train_models(feat_df: pd.DataFrame,
                 max_season: int, max_week: int | None = None) -> dict:
    """(max_season, max_week) ÖNCESİ satırlarla stat başına model eğitir.

    Sayım-tipi hedefler (targets, receptions, TD'ler, int...) Poisson loss
    ile eğitilir — kare-hata bu statlarda dağılımı aşırı düzleştirip
    tahmini gerçek varyanstan çok daha dar bir aralığa sıkıştırıyordu.
    Yard statları (sürekli, sayım değil) kare-hatada kalır.
    """
    from sklearn.ensemble import HistGradientBoostingRegressor

    train = _train_split(feat_df, max_season, max_week)
    if train is None:
        return {}
    X = train[FEATURE_COLS].astype(float)
    models = {}
    for t in TARGETS:
        loss = "poisson" if t in COUNT_TARGETS else "squared_error"
        m = HistGradientBoostingRegressor(
            loss=loss,
            max_iter=220, learning_rate=0.06, max_depth=None,
            max_leaf_nodes=31, min_samples_leaf=20,
            l2_regularization=0.4, random_state=42)
        y = train[t].astype(float)
        if loss == "poisson":
            y = y.clip(lower=0)  # Poisson negatif hedef kabul etmez
        m.fit(X, y)
        models[t] = m
    log.info("ML modelleri eğitildi: %s hedef, %s satır", len(models), len(train))
    return models


# taban (p20) / tavan (p80) — "ortalamaya yakınsama" şikâyetinin asıl
# çözümü: tek bir nokta tahmini yerine gerçekçi bir aralık. Kare-hata/
# Poisson modelleri E[Y|X]'i (koşullu BEKLENEN değeri) tahmin eder — bu,
# matematiksel olarak gerçek sonuçlardan daha düşük varyanslı olmak
# ZORUNDADIR (Var(Y) = Var(E[Y|X]) + E[Var(Y|X)]); yani "herkes ortalamaya
# yakın" görünümü büyük ölçüde beklenen-değer tahmininin doğası. Asıl
# eksik olan, bu belirsizliği kullanıcıya göstermekti. ÖNEMLİ: bu aralık
# fantasy puanı için değil, TARGETS'teki HER GERÇEK MAÇ İSTATİSTİĞİ için
# ayrı ayrı üretilir (rec yds, rush yds, pas yds, target, reception...) —
# projeksiyonun asıl amacı fantasy skoru değil gerçek istatistiklerdir.
QUANTILES = (0.2, 0.8)


def train_quantile_models(feat_df: pd.DataFrame, max_season: int,
                          max_week: int | None = None,
                          targets: list[str] | None = None) -> dict:
    """Her (pozisyon, hedef GERÇEK istatistik) çifti için taban/tavan
    (p20/p80) quantile regressor'ları — POZİSYONA GÖRE AYRI eğitilir.

    Önce tüm ilgili pozisyonları havuzlayarak denedik (ör. receiving_yards
    için RB+WR+TE birlikte) ama bu bile p20'yi yanlış çekiyordu: WR1
    seviyesi bir oyuncu için taban 0 çıkıyordu, oysa gerçek veride sezon
    60+ yd/maç ortalamalı WR'lerin p20'si ~39 yd. Havuzdaki RB/TE
    satırları (çok daha düşük hacim) düşük ucu domine ediyor, pos_WR
    özelliği tek başına ağacın bunu telafi etmesine yetmiyor — yalnızca
    TEK pozisyonla eğitince (ör. sadece WR) taban 38.8'e çıktı, doğrulandı.
    targets verilmezse TARGETS'teki 12 statın hepsi için eğitir.
    Dönüş: {(pozisyon, stat): {quantile: model}}."""
    from sklearn.ensemble import HistGradientBoostingRegressor

    targets = list(targets) if targets is not None else TARGETS
    train = _train_split(feat_df, max_season, max_week)
    if train is None:
        return {}
    models: dict = {}
    for t in targets:
        for pos in STAT_POSITIONS.get(t, SKILL_POS):
            sub = train[train["position"] == pos]
            if len(sub) < 500:
                continue  # bu pozisyon-stat kombinasyonu için yetersiz veri
            X = sub[FEATURE_COLS].astype(float)
            y = sub[t].astype(float).clip(lower=0)
            tm = {}
            for q in QUANTILES:
                # l2_regularization=0 ZORUNLU: pinball (quantile) loss'un
                # gradyanları sabit ve küçüktür (±q civarı), kare-hata/
                # Poisson için ayarlanmış l2 burada orantısız güçlü kalıp
                # modeli her girdide 0'a çöktürüyordu (doğrulandı — l2>0
                # iken tüm tahminler 0 çıkıyordu, l2=0'da doğru ayrışıyor).
                m = HistGradientBoostingRegressor(
                    loss="quantile", quantile=q,
                    max_iter=220, learning_rate=0.06, max_depth=None,
                    max_leaf_nodes=31, min_samples_leaf=20,
                    l2_regularization=0.0, random_state=42)
                m.fit(X, y)
                tm[q] = m
            models[(pos, t)] = tm
    return models


def predict_quantiles(models: dict, rows: pd.DataFrame) -> pd.DataFrame:
    """Her (pozisyon, hedef stat) çifti için proj_floor_<stat> (p20) /
    proj_ceiling_<stat> (p80) tahminleri — her satır kendi pozisyonunun
    modeliyle tahmin edilir."""
    out = rows[["player_id"]].copy()
    stats = {t for (_, t) in models}
    for (pos, t), tm in models.items():
        mask = (rows["position"] == pos).values
        if not mask.any():
            continue
        Xp = rows.loc[mask, FEATURE_COLS].astype(float)
        for q, m in tm.items():
            col = f"proj_floor_{t}" if q < 0.5 else f"proj_ceiling_{t}"
            if col not in out.columns:
                out[col] = np.nan
            out.loc[mask, col] = np.clip(m.predict(Xp), 0, None).round(1)
    for t in stats:
        fc, cc = f"proj_floor_{t}", f"proj_ceiling_{t}"
        if fc in out.columns and cc in out.columns:
            # p20 > p80 gibi nadir çapraz durumları düzelt (küçük örneklemde olabilir)
            lo = out[[fc, cc]].min(axis=1)
            hi = out[[fc, cc]].max(axis=1)
            out[fc], out[cc] = lo, hi
    return out


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
            **{s: np.nan for s in AUX_STATS},
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
