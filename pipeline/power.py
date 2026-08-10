"""Haftalık güç sıralaması — NFL ve NCAA için ortak motor.

İki ayrı sıralama üretir: **hücum** ve **savunma**. İkisi de rakibe göre
düzeltilmiştir; ham puan ortalaması yanıltıcı olurdu çünkü takımlar çok
farklı fikstürler oynuyor (NCAA'de uçurum, NFL'de de belirgin).

Yöntem — basit bir SRS (simple rating system):

    hücum_i  = ağırlıklı ort.( attığı puan − lig ort. + rakibin savunması )
    savunma_i = ağırlıklı ort.( lig ort. + rakibin hücumu − yediği puan )

İki denklem birbirine bağlı olduğu için sabit noktaya kadar yineleniyor.
Sonuç "lig ortalamasına göre maç başına puan" cinsinden: hücumda +6.0, bu
takımın ortalama bir savunmaya karşı lig ortalamasından 6 puan fazla
attığı anlamına gelir. Savunmada +6.0 iyi (6 puan az yediriyor).

Form: maçlar yarılanma ömrüyle ağırlıklandırılıyor (varsayılan 4 hafta),
yani son haftalar sıralamayı sezon başından daha çok belirliyor.

Kadro kalitesi: NFL'de derinlik şemasındaki ilk sıra oyuncuların son
dönem üretimi ve sakatlık durumu küçük bir düzeltme olarak giriyor —
"kağıt üstünde iyi ama yarısı sakat" takımlar öne çıkmasın diye.

Çıktı: web/public/data/power.json ve .../ncaa/power.json
"""
import json
import logging
from datetime import datetime, timezone

import numpy as np
import pandas as pd

import config
import transform

log = logging.getLogger(__name__)

HALFLIFE = 4.0      # form penceresi: kaç haftada bir ağırlık yarıya iner
ITERATIONS = 20     # SRS yinelemesi (10-15'te oturuyor, pay bırakıldı)
MIN_GAMES = 2       # bu kadar maç oynamamış takım sıralanmaz

# Kadro düzeltmesinin toplam içindeki payı. Küçük tutuldu: derinlik şeması
# haftalık kesinlik taşımıyor, sinyal değil düzeltme olarak kullanılıyor.
ROSTER_WEIGHT = 0.15


def _z(s: pd.Series) -> pd.Series:
    s = pd.to_numeric(s, errors="coerce")
    std = s.std(ddof=0)
    if not std or np.isnan(std):
        return pd.Series(0.0, index=s.index)
    return ((s - s.mean()) / std).fillna(0.0)


def _num(v, d: int = 2):
    if v is None:
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return None if np.isnan(f) else round(f, d)


# --------------------------------------------------------------------- srs

def srs(games: pd.DataFrame, halflife: float = HALFLIFE,
        iterations: int = ITERATIONS) -> pd.DataFrame:
    """Rakibe göre düzeltilmiş hücum/savunma puanları.

    games: her satır bir takımın bir maçı —
           [team, opponent, points, points_allowed, week]
    Döndürür: index=team, kolonlar [off, def, games, ppg, papg]
              (lig ortalamasına göre maç başına puan; ikisinde de + = iyi)
    """
    g = games.dropna(subset=["points", "points_allowed", "opponent"]).copy()
    for c in ("points", "points_allowed", "week"):
        g[c] = pd.to_numeric(g[c], errors="coerce")
    g = g.dropna(subset=["points", "points_allowed"])
    if g.empty:
        return pd.DataFrame(columns=["off", "def", "games", "ppg", "papg"])

    last_week = g["week"].max()
    g["w"] = 0.5 ** ((last_week - g["week"]) / halflife)
    league_avg = float(np.average(g["points"], weights=g["w"]))

    teams = sorted(set(g["team"]) | set(g["opponent"]))
    off = pd.Series(0.0, index=teams)
    dfn = pd.Series(0.0, index=teams)

    for _ in range(iterations):
        # Attığı puan, rakibin savunması kadar yukarı düzeltilir
        g["off_obs"] = g["points"] - league_avg + g["opponent"].map(dfn).fillna(0.0)
        # Yediği puan, rakibin hücumu kadar aşağı düzeltilir
        g["def_obs"] = (league_avg + g["opponent"].map(off).fillna(0.0)
                        - g["points_allowed"])

        new_off = g.groupby("team").apply(
            lambda d: np.average(d["off_obs"], weights=d["w"]), include_groups=False)
        new_def = g.groupby("team").apply(
            lambda d: np.average(d["def_obs"], weights=d["w"]), include_groups=False)
        # Ortalamayı sıfırda tut, yoksa iki taraf birlikte kayıyor
        off = (new_off - new_off.mean()).reindex(teams).fillna(0.0)
        dfn = (new_def - new_def.mean()).reindex(teams).fillna(0.0)

    counts = g.groupby("team").size()
    ppg = g.groupby("team").apply(
        lambda d: np.average(d["points"], weights=d["w"]), include_groups=False)
    papg = g.groupby("team").apply(
        lambda d: np.average(d["points_allowed"], weights=d["w"]), include_groups=False)

    out = pd.DataFrame({"off": off, "def": dfn})
    out["games"] = counts.reindex(teams).fillna(0).astype(int)
    out["ppg"] = ppg.reindex(teams)
    out["papg"] = papg.reindex(teams)
    return out[out["games"] >= MIN_GAMES]


# ----------------------------------------------------------- kadro kalitesi

def roster_quality(depth: pd.DataFrame | None, injuries: pd.DataFrame | None,
                   pw: pd.DataFrame | None, last_week: int) -> pd.DataFrame:
    """Takım başına ilk-sıra üretimi ve sakat başlangıç oyuncusu sayısı.

    "Kadro kalitesi" burada iddialı bir oyuncu notu değil: derinlik
    şemasındaki 1. sıradaki hücum oyuncularının son haftalardaki gerçek
    üretimi + kaçının raporda "Out/Doubtful" göründüğü.
    """
    empty = pd.DataFrame(columns=["starter_ppr", "off_out", "def_out"])
    if depth is None or depth.empty or "depth" not in depth.columns:
        return empty

    d = depth.copy()
    d["depth"] = pd.to_numeric(d["depth"], errors="coerce")
    starters = d[d["depth"] == 1]
    if starters.empty:
        return empty

    off_pos = ["QB", "RB", "WR", "TE"]
    out = pd.DataFrame(index=sorted(starters["team"].dropna().unique()))

    # İlk sıra hücum oyuncularının son penceredeki maç başı PPR toplamı
    if pw is not None and not pw.empty:
        reg = pw[pw["season_type"] == "REG"].copy()
        reg["week"] = pd.to_numeric(reg["week"], errors="coerce")
        recent = reg[reg["week"] > last_week - 4]
        per_player = recent.groupby("player_id")["fantasy_points_ppr"].mean()
        so = starters[starters["position"].isin(off_pos)].copy()
        so["ppr"] = so["player_id"].map(per_player)
        out["starter_ppr"] = so.groupby("team")["ppr"].sum()

    # Oynaması beklenmeyen başlangıç oyuncuları
    if injuries is not None and not injuries.empty:
        inj = injuries.copy()
        for c in ("season", "week"):
            inj[c] = pd.to_numeric(inj.get(c), errors="coerce")
        inj = (inj.sort_values(["season", "week"])
                  .drop_duplicates("player_id", keep="last"))
        sidelined = set(inj[inj["report_status"].astype(str).str.lower()
                            .isin(["out", "doubtful", "injured reserve", "ir"])]
                        ["player_id"].astype(str))
        s = starters.copy()
        s["hurt"] = s["player_id"].astype(str).isin(sidelined)
        s["side"] = np.where(s["position"].isin(off_pos), "off_out", "def_out")
        counts = s[s["hurt"]].groupby(["team", "side"]).size().unstack(fill_value=0)
        for col in ("off_out", "def_out"):
            out[col] = counts[col] if col in counts.columns else 0

    return out.fillna(0.0)


# ------------------------------------------------------------------ derleme

def _ranked(df: pd.DataFrame, col: str, ascending: bool = False) -> pd.Series:
    return df[col].rank(ascending=ascending, method="min").astype("Int64")


def build(games: pd.DataFrame, *, extras: pd.DataFrame | None = None,
          roster: pd.DataFrame | None = None,
          weights: dict | None = None) -> pd.DataFrame:
    """SRS + lige özgü ek metrikleri harmanlayıp sıralamayı üretir.

    extras: index=team, [off_extra, def_extra] — z-skoru alınacak, yüksek
            olan iyi (savunmada işareti çağıran tarafta çevrilmiş olmalı).
    """
    base = srs(games)
    if base.empty:
        return base

    w = {"srs": 0.70, "extra": 0.30}
    if weights:
        w.update(weights)

    off = w["srs"] * _z(base["off"])
    dfn = w["srs"] * _z(base["def"])
    if extras is not None and not extras.empty:
        e = extras.reindex(base.index)
        if "off_extra" in e.columns:
            off = off + w["extra"] * _z(e["off_extra"])
            base["off_extra"] = e["off_extra"]
        if "def_extra" in e.columns:
            dfn = dfn + w["extra"] * _z(e["def_extra"])
            base["def_extra"] = e["def_extra"]

    if roster is not None and not roster.empty:
        r = roster.reindex(base.index)
        if "starter_ppr" in r.columns:
            off = off + ROSTER_WEIGHT * _z(r["starter_ppr"])
            base["starter_ppr"] = r["starter_ppr"].round(1)
        # Sakat başlangıç oyuncusu her iki tarafı da aşağı çeker
        for col, series in (("off_out", "off"), ("def_out", "def")):
            if col in r.columns:
                pen = 0.10 * pd.to_numeric(r[col], errors="coerce").fillna(0)
                if series == "off":
                    off = off - pen
                else:
                    dfn = dfn - pen
                base[col] = r[col].fillna(0).astype(int)

    # Okunur ölçek: z-skoru yeniden puan/maç cinsine yay
    base["off_rating"] = (off * base["off"].std(ddof=0)).round(2)
    base["def_rating"] = (dfn * base["def"].std(ddof=0)).round(2)
    base["overall_rating"] = (base["off_rating"] + base["def_rating"]).round(2)

    base["off_rank"] = _ranked(base, "off_rating")
    base["def_rank"] = _ranked(base, "def_rating")
    base["overall_rank"] = _ranked(base, "overall_rating")
    base["ppg"] = base["ppg"].round(1)
    base["papg"] = base["papg"].round(1)
    return base.sort_values("overall_rank")


def write(path, df: pd.DataFrame, *, season: int, week: int,
          league: str) -> None:
    """Kolonsal JSON + bir önceki dosyadaki sıralamalardan trend."""
    prev = {}
    if path.exists():
        try:
            with open(path) as f:
                old = json.load(f)
            idx = {c: i for i, c in enumerate(old["columns"])}
            # Aynı hafta yeniden üretiliyorsa trendi koru, üst üste bindirme
            same_week = old.get("through_week") == week
            for row in old["rows"]:
                prev[row[idx["team"]]] = {
                    "off": row[idx["off_prev_rank"]] if same_week and "off_prev_rank" in idx
                           else row[idx["off_rank"]],
                    "def": row[idx["def_prev_rank"]] if same_week and "def_prev_rank" in idx
                           else row[idx["def_rank"]],
                }
        except (KeyError, ValueError, TypeError):
            log.warning("Önceki power.json okunamadı, trend atlanıyor")

    out = df.reset_index().rename(columns={"index": "team"})
    out["off_prev_rank"] = out["team"].map(lambda t: (prev.get(t) or {}).get("off"))
    out["def_prev_rank"] = out["team"].map(lambda t: (prev.get(t) or {}).get("def"))

    cols = [c for c in ["team", "off_rating", "off_rank", "off_prev_rank",
                        "def_rating", "def_rank", "def_prev_rank",
                        "overall_rating", "overall_rank",
                        "games", "ppg", "papg", "starter_ppr",
                        "off_out", "def_out"]
            if c in out.columns]
    safe = out[cols].astype(object).where(pd.notna(out[cols]), None)
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "league": league,
        "data_season": season,
        "through_week": week,
        "halflife_weeks": HALFLIFE,
        "columns": cols,
        "rows": safe.values.tolist(),
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"),
                  allow_nan=False)
    log.info("Power ranking yazıldı: %s (%s takım, %s W%s)",
             path.name, len(out), season, week)


# --------------------------------------------------------------------- nfl

def _nfl_games(sched: pd.DataFrame, season: int) -> pd.DataFrame:
    """Fikstürü takım-maç satırlarına açar (her maç iki satır)."""
    s = sched[(pd.to_numeric(sched["season"], errors="coerce") == season)
              & sched["home_score"].notna()].copy()
    if s.empty:
        return s
    home = s.rename(columns={"home_team": "team", "away_team": "opponent",
                             "home_score": "points", "away_score": "points_allowed"})
    away = s.rename(columns={"away_team": "team", "home_team": "opponent",
                             "away_score": "points", "home_score": "points_allowed"})
    keep = ["team", "opponent", "points", "points_allowed", "week"]
    return pd.concat([home[keep], away[keep]], ignore_index=True)


def _latest_processed(root) -> int | None:
    dirs = sorted((root / "seasons").glob("*"))
    return int(dirs[-1].name) if dirs else None


def build_nfl(season: int | None = None,
              schedules: pd.DataFrame | None = None) -> pd.DataFrame:
    # Sezon dışında current_season() henüz işlenmemiş yılı gösteriyor;
    # elde ne varsa ondan hesapla
    if season is None or not (config.DATA_DIR / "seasons" / str(season)).exists():
        season = _latest_processed(config.DATA_DIR)
    if season is None:
        log.warning("NFL power: işlenmiş sezon yok")
        return pd.DataFrame()

    sdir = config.DATA_DIR / "seasons" / str(season)
    sched = transform.read_json(sdir / "schedule.json")
    if sched is None or sched.empty:
        log.warning("NFL power: fikstür yok (%s)", season)
        return pd.DataFrame()
    games = _nfl_games(sched, season)
    if games.empty:
        log.warning("NFL power: oynanmış maç yok (%s)", season)
        return pd.DataFrame()

    # EPA/play, SRS'in göremediği verimlilik farkını taşıyor
    extras = None
    ta = transform.read_json(sdir / "team_advanced.json")
    if ta is not None and not ta.empty:
        extras = pd.DataFrame({
            "off_extra": pd.to_numeric(ta["off_epa_play"], errors="coerce"),
            # savunmada düşük EPA iyi — işaret çevriliyor
            "def_extra": -pd.to_numeric(ta["def_epa_play"], errors="coerce"),
        }, index=ta["team"])

    pw = transform.read_json(sdir / "player_weeks.json")
    last_week = int(pd.to_numeric(games["week"], errors="coerce").max())
    roster = roster_quality(
        transform.read_json(config.DATA_DIR / "depth_charts.json"),
        transform.read_json(config.DATA_DIR / "injuries.json"),
        pw, last_week)

    df = build(games, extras=extras, roster=roster)
    if not df.empty:
        write(config.DATA_DIR / "power.json", df,
              season=season, week=last_week, league="nfl")
    return df


# -------------------------------------------------------------------- ncaa

NCAA_DIR = config.DATA_DIR / "ncaa"


def build_ncaa(season: int | None = None) -> pd.DataFrame:
    """NCAA'de EPA yok; SRS'e yard verimliliği ekleniyor.

    Rakibe göre düzeltme burada NFL'den daha kritik: FBS'te fikstür farkı
    uçurum, ham puan ortalaması neredeyse anlamsız.
    """
    if season is None or not (NCAA_DIR / "seasons" / str(season)).exists():
        season = _latest_processed(NCAA_DIR)
    if season is None:
        log.warning("NCAA power: işlenmiş sezon yok")
        return pd.DataFrame()
    tw = transform.read_json(NCAA_DIR / "seasons" / str(season) / "team_weeks.json")
    if tw is None or tw.empty:
        log.warning("NCAA power: takım-hafta verisi yok (%s)", season)
        return pd.DataFrame()

    g = tw.copy()
    for c in ("points", "points_allowed", "week", "total_yards"):
        if c in g.columns:
            g[c] = pd.to_numeric(g[c], errors="coerce")
    games = g[["team", "opponent", "points", "points_allowed", "week"]].dropna(
        subset=["points", "points_allowed"])
    if games.empty:
        return pd.DataFrame()

    # Yard verimliliği: kendi toplam yardı ve rakiplerinin ona karşı yardı
    extras = None
    if "total_yards" in g.columns:
        own = g.groupby("team")["total_yards"].mean()
        # Rakibin bu takıma karşı yaptığı yard = savunmanın yedirdiği
        allowed = g.merge(g[["game_id", "team", "total_yards"]],
                          on="game_id", suffixes=("", "_opp"))
        allowed = allowed[allowed["team"] != allowed["team_opp"]]
        allowed = allowed.groupby("team")["total_yards_opp"].mean()
        extras = pd.DataFrame({"off_extra": own, "def_extra": -allowed})

    last_week = int(games["week"].max())
    df = build(games, extras=extras)
    if not df.empty:
        write(NCAA_DIR / "power.json", df,
              season=season, week=last_week, league="ncaa")
    return df
