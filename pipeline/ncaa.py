"""NCAA (college football, FBS) veri pipeline'ı — ESPN public API kaynaklı.

nflverse NCAA verisi sunmadığı için omurga ESPN'dir:
  - scoreboard: sezon/hafta bazlı maç listesi (groups=80 = FBS)
  - summary:    maç box score'u (oyuncu passing/rushing/receiving + takım statları)
  - groups:     konferans adları

Kolon adları NFL tarafıyla aynı tutulur (passing_yards, carries, receptions...)
ki arayüzdeki etiketler ve grafik presetleri değişmeden çalışsın.
"""
from __future__ import annotations

import json
import logging
import time

import pandas as pd
import requests

import config
import transform

log = logging.getLogger("pipeline.ncaa")

SITE = "https://site.api.espn.com/apis/site/v2/sports/football/college-football"
CORE = "https://sports.core.api.espn.com/v2/sports/football/leagues/college-football"
NCAA_DIR = config.DATA_DIR / "ncaa"
NCAA_SEASONS = [2022, 2023, 2024, 2025]  # son 4 yıl
REQUEST_SLEEP = 0.12  # ESPN'e nazik davran

_session = requests.Session()
_session.headers["User-Agent"] = "Mozilla/5.0 (NFL-Tracker pipeline)"


def _get(url: str, retries: int = 3) -> dict | None:
    for i in range(retries):
        try:
            r = _session.get(url, timeout=30)
            if r.status_code == 200:
                time.sleep(REQUEST_SLEEP)
                return r.json()
            log.warning("HTTP %s: %s", r.status_code, url)
        except (requests.RequestException, json.JSONDecodeError) as e:
            log.warning("İstek hatası (%s/%s): %s", i + 1, retries, e)
        time.sleep(1.5 * (i + 1))
    return None


def _num(v) -> float | None:
    """ESPN displayValue -> sayı ('--', '' -> None)."""
    try:
        s = str(v).replace(",", "").strip()
        if s in ("", "--", "-"):
            return None
        f = float(s)
        return int(f) if f.is_integer() else f
    except (ValueError, TypeError):
        return None


# ---------------------------------------------------------------- fikstür

def fetch_season_events(season: int) -> list[dict]:
    """Bir sezonun tüm FBS maçları (REG + bowls/playoff)."""
    events = []
    for stype, weeks in ((2, range(1, 17)), (3, range(1, 3))):
        for wk in weeks:
            d = _get(f"{SITE}/scoreboard?dates={season}&seasontype={stype}"
                     f"&week={wk}&groups=80&limit=400")
            evs = (d or {}).get("events", [])
            if not evs and stype == 2 and wk > 14:
                break  # sezonun REG haftaları bitti
            for e in evs:
                e["_season_type"] = "REG" if stype == 2 else "POST"
                e["_week"] = wk
            events.extend(evs)
    log.info("NCAA %s: %s maç bulundu", season, len(events))
    return events


def parse_schedule(events: list[dict], season: int):
    """events -> (schedule_df, teams_map, conf_of_team)"""
    rows, teams, conf_of = [], {}, {}
    for e in events:
        c = e["competitions"][0]
        home = away = None
        for t in c.get("competitors", []):
            tm = t.get("team", {})
            abbr = tm.get("abbreviation") or tm.get("shortDisplayName")
            if not abbr:
                continue
            logos = tm.get("logos") or []
            teams.setdefault(abbr, {
                "team_id": tm.get("id"),
                "team": abbr,
                "school": tm.get("location") or tm.get("displayName"),
                "name": tm.get("displayName"),
                "logo": (logos[0]["href"] if logos else
                         f"https://a.espncdn.com/i/teamlogos/ncaa/500/{tm.get('id')}.png"),
            })
            if tm.get("conferenceId"):
                conf_of[abbr] = str(tm["conferenceId"])
            rec = {"abbr": abbr, "score": _num(t.get("score"))}
            if t.get("homeAway") == "home":
                home = rec
            else:
                away = rec
        if not home or not away:
            continue
        done = c["status"]["type"]["name"] == "STATUS_FINAL"
        rows.append({
            "game_id": str(e["id"]),
            "season": season,
            "week": e["_week"],
            "season_type": e["_season_type"],
            "gameday": str(e.get("date", ""))[:10],
            "kickoff": e.get("date"),  # ISO UTC (saat gösterimi için)
            "name": e.get("shortName"),
            "home_team": home["abbr"], "away_team": away["abbr"],
            # Oynanmamış maçta ESPN 0 döndürür — skoru boş bırak
            "home_score": home["score"] if done else None,
            "away_score": away["score"] if done else None,
            "neutral_site": bool(c.get("neutralSite")),
            "conference_game": bool(c.get("conferenceCompetition")),
            "completed": c["status"]["type"]["name"] == "STATUS_FINAL",
        })
    return pd.DataFrame(rows), teams, conf_of


_conf_cache: dict[str, str] = {}


def conference_names(season: int, conf_ids: set[str]) -> dict[str, str]:
    out = {}
    for cid in conf_ids:
        if cid not in _conf_cache:
            d = _get(f"{CORE}/seasons/{season}/types/2/groups/{cid}?lang=en")
            _conf_cache[cid] = (d or {}).get("shortName") or (d or {}).get("name") or f"Conf {cid}"
        out[cid] = _conf_cache[cid]
    return out


# ---------------------------------------------------------------- box score

# ESPN kategori etiketi -> bizim kolonlar
_PASS = {"YDS": "passing_yards", "TD": "passing_tds",
         "INT": "passing_interceptions", "QBR": "qbr"}
_RUSH = {"CAR": "carries", "YDS": "rushing_yards", "TD": "rushing_tds",
         "LONG": "rush_long"}
_RECV = {"REC": "receptions", "YDS": "receiving_yards", "TD": "receiving_tds",
         "LONG": "rec_long"}
CATEGORIES = {"passing": _PASS, "rushing": _RUSH, "receiving": _RECV}

TEAM_STATS = {
    "firstDowns": "first_downs", "totalYards": "total_yards",
    "netPassingYards": "passing_yards", "rushingYards": "rushing_yards",
    "rushingAttempts": "rushing_attempts", "yardsPerPass": "yards_per_pass",
    "yardsPerRushAttempt": "yards_per_rush", "turnovers": "turnovers",
    "fumblesLost": "fumbles_lost", "interceptions": "interceptions_thrown",
}


def parse_box(game: dict, meta: dict) -> tuple[list[dict], list[dict]]:
    """summary json -> (player satırları, takım satırları)"""
    bs = game.get("boxscore") or {}
    sides = bs.get("players") or []
    players: dict[str, dict] = {}
    abbrs = [s.get("team", {}).get("abbreviation") for s in sides]
    for side in sides:
        abbr = side.get("team", {}).get("abbreviation")
        opp = next((a for a in abbrs if a != abbr), None)
        for cat in side.get("statistics", []):
            colmap = CATEGORIES.get(cat.get("name"))
            if not colmap:
                continue
            labels = cat.get("labels", [])
            for ath in cat.get("athletes", []):
                a, stats = ath.get("athlete", {}), ath.get("stats", [])
                pid = str(a.get("id"))
                if not pid or not stats:
                    continue
                row = players.setdefault(pid, {
                    **meta, "player_id": pid,
                    "player_name": a.get("displayName"),
                    "headshot": (a.get("headshot") or {}).get("href"),
                    "team": abbr, "opponent": opp,
                })
                for lab, val in zip(labels, stats):
                    if lab == "C/ATT" and "/" in str(val):
                        cmp_, att = str(val).split("/", 1)
                        row["completions"] = _num(cmp_)
                        row["attempts"] = _num(att)
                    elif lab in colmap:
                        row[colmap[lab]] = _num(val)

    team_rows = []
    for side in bs.get("teams") or []:
        abbr = side.get("team", {}).get("abbreviation")
        opp = next((a for a in abbrs if a != abbr), None)
        row = {**meta, "team": abbr, "opponent": opp}
        for s in side.get("statistics", []):
            name, val = s.get("name"), s.get("displayValue")
            if name in TEAM_STATS:
                row[TEAM_STATS[name]] = _num(val)
            elif name == "thirdDownEff" and "-" in str(val):
                made, att = str(val).split("-", 1)
                m, a = _num(made), _num(att)
                row["third_down_pct"] = round(100 * m / a, 1) if m is not None and a else None
            elif name == "possessionTime" and ":" in str(val):
                mm, ss = str(val).split(":", 1)
                row["possession_sec"] = (_num(mm) or 0) * 60 + (_num(ss) or 0)
        team_rows.append(row)
    return list(players.values()), team_rows


def _position(row: pd.Series) -> str:
    """Box score pozisyon vermez; hacimden çıkar."""
    def val(c):
        v = row.get(c)
        return 0 if v is None or pd.isna(v) else float(v)
    if val("attempts") >= 3:
        return "QB"
    if val("carries") > val("receptions"):
        return "RB"
    return "WR"


# ---------------------------------------------------------------- sezon kurulumu

def _read_existing(path) -> pd.DataFrame | None:
    return transform.read_json(path)


def build_season(season: int, incremental: bool = True) -> bool:
    """Bir NCAA sezonunu indir/güncelle. True = veri yazıldı."""
    sdir = NCAA_DIR / "seasons" / str(season)
    events = fetch_season_events(season)
    if not events:
        log.warning("NCAA %s: maç bulunamadı (sezon başlamamış olabilir)", season)
        return False
    sched, teams, conf_of = parse_schedule(events, season)

    old_pw = _read_existing(sdir / "player_weeks.json") if incremental else None
    old_tw = _read_existing(sdir / "team_weeks.json") if incremental else None
    have = set(old_pw["game_id"].astype(str)) if old_pw is not None else set()

    todo = sched[sched["completed"] & ~sched["game_id"].isin(have)]
    log.info("NCAA %s: %s yeni maçın box score'u çekilecek", season, len(todo))
    p_rows, t_rows = [], []
    for i, g in enumerate(todo.itertuples(), 1):
        d = _get(f"{SITE}/summary?event={g.game_id}")
        if d is None:
            continue
        meta = {"game_id": g.game_id, "season": season,
                "week": g.week, "season_type": g.season_type}
        pr, tr = parse_box(d, meta)
        p_rows.extend(pr)
        t_rows.extend(tr)
        if i % 100 == 0:
            log.info("NCAA %s: %s/%s maç işlendi", season, i, len(todo))

    pw = pd.DataFrame(p_rows)
    tw = pd.DataFrame(t_rows)
    if old_pw is not None and not old_pw.empty:
        pw = pd.concat([old_pw, pw], ignore_index=True)
    if old_tw is not None and not old_tw.empty:
        tw = pd.concat([old_tw, tw], ignore_index=True)
    if pw.empty:
        log.warning("NCAA %s: oyuncu verisi yok", season)
        return False
    pw = pw.drop_duplicates(["game_id", "player_id"])
    tw = tw.drop_duplicates(["game_id", "team"])

    pw["position"] = pw.apply(_position, axis=1)

    # Takım maç satırlarına skorları bağla (artımlıda eski kolonları at,
    # yoksa merge points_x/points_y üretir)
    tw = tw.drop(columns=[c for c in ("points", "points_allowed")
                          if c in tw.columns])
    pts = pd.concat([
        sched.rename(columns={"home_team": "team", "home_score": "points",
                              "away_score": "points_allowed"})
             [["game_id", "team", "points", "points_allowed"]],
        sched.rename(columns={"away_team": "team", "away_score": "points",
                              "home_score": "points_allowed"})
             [["game_id", "team", "points", "points_allowed"]],
    ], ignore_index=True)
    tw = tw.merge(pts, on=["game_id", "team"], how="left")

    confs = conference_names(season, set(conf_of.values()))

    transform.write_json(sdir / "schedule.json",
                         sched.drop(columns=["completed"]))
    transform.write_json(sdir / "player_weeks.json",
                         pw.sort_values(["week", "team"]).reset_index(drop=True))
    transform.write_json(sdir / "team_weeks.json",
                         tw.sort_values(["week", "team"]).reset_index(drop=True))
    transform.write_json(sdir / "player_season.json", season_agg(pw))
    transform.write_json(sdir / "team_season.json",
                         team_agg(tw, sched, conf_of, confs))
    _write_teams(teams, conf_of, confs)
    return True


SUM_COLS = ["completions", "attempts", "passing_yards", "passing_tds",
            "passing_interceptions", "carries", "rushing_yards", "rushing_tds",
            "targets", "receptions", "receiving_yards", "receiving_tds"]


def season_agg(pw: pd.DataFrame) -> pd.DataFrame:
    reg = pw[pw["season_type"] == "REG"].copy()
    if reg.empty:
        reg = pw.copy()
    cols = [c for c in SUM_COLS if c in reg.columns]
    g = reg.groupby("player_id")
    out = g[cols].sum(min_count=1).round(1)
    out["games"] = g.size()
    out["player_name"] = g["player_name"].last()
    out["team"] = g["team"].last()
    out["headshot"] = g["headshot"].last()
    # Sezonluk baskın rol
    out["position"] = g["position"].agg(lambda s: s.mode().iat[0])
    out["season"] = int(reg["season"].iloc[0])
    return out.reset_index()


def team_agg(tw: pd.DataFrame, sched: pd.DataFrame,
             conf_of: dict, confs: dict) -> pd.DataFrame:
    reg = tw[tw["season_type"].isin(["REG", "POST"])].copy()
    g = reg.groupby("team")
    num = [c for c in ("points", "points_allowed", "total_yards", "passing_yards",
                       "rushing_yards", "turnovers", "third_down_pct") if c in reg.columns]
    out = g[num].mean().round(1).rename(columns={c: f"{c}_pg" for c in num})
    out["games"] = g.size()
    out["wins"] = g.apply(
        lambda df: int((df["points"] > df["points_allowed"]).sum()),
        include_groups=False)
    out["losses"] = out["games"] - out["wins"]
    # Konferans içi W-L
    conf_games = reg.merge(
        sched[sched["conference_game"]][["game_id"]], on="game_id")
    cg = conf_games.groupby("team")
    out["conf_wins"] = cg.apply(
        lambda df: int((df["points"] > df["points_allowed"]).sum()),
        include_groups=False)
    out["conf_losses"] = cg.size() - out["conf_wins"]
    out = out.reset_index()
    out["conference"] = out["team"].map(
        lambda t: confs.get(conf_of.get(t, ""), "Diğer"))
    out["season"] = int(reg["season"].iloc[0]) if not reg.empty else None
    # FBS dışı (1-2 maçlık rakipler) tabloyu kirletmesin
    return out[out["games"] >= 6].reset_index(drop=True)


def _write_teams(teams: dict, conf_of: dict, confs: dict) -> None:
    """teams.json: kimlikler kümülatif birleşir (sezonlar arası)."""
    old = _read_existing(NCAA_DIR / "teams.json")
    df = pd.DataFrame(list(teams.values()))
    df["conference"] = df["team"].map(
        lambda t: confs.get(conf_of.get(t, ""), None))
    if old is not None and not old.empty:
        df = (pd.concat([old, df], ignore_index=True)
                .drop_duplicates("team", keep="last"))
    transform.write_json(NCAA_DIR / "teams.json",
                         df.sort_values("team").reset_index(drop=True))


# ---------------------------------------------------------------- kadrolar / fikstür / projeksiyon

SKILL_POS = {"QB", "RB", "FB", "WR", "TE"}


def fetch_rosters() -> pd.DataFrame | None:
    """Güncel kadrolar (gerçek pozisyonlarla) — FBS takımları için."""
    teams = _read_existing(NCAA_DIR / "teams.json")
    if teams is None or teams.empty:
        return None
    # FBS filtresi: son sezonun team_season'ında yer alan takımlar
    fbs = None
    for sdir in sorted((NCAA_DIR / "seasons").glob("*"), reverse=True):
        ts = _read_existing(sdir / "team_season.json")
        if ts is not None and not ts.empty:
            fbs = set(ts["team"])
            break
    rows = []
    todo = teams if fbs is None else teams[teams["team"].isin(fbs)]
    log.info("NCAA kadrolar: %s takım çekilecek", len(todo))
    for t in todo.itertuples():
        d = _get(f"{SITE}/teams/{t.team_id}/roster")
        if d is None:
            continue
        for grp in d.get("athletes", []):
            for a in grp.get("items", []):
                exp = a.get("experience") or {}
                rows.append({
                    "player_id": str(a.get("id")),
                    "player_name": a.get("displayName"),
                    "position": (a.get("position") or {}).get("abbreviation"),
                    "team": t.team,
                    "jersey": a.get("jersey"),
                    "class": exp.get("displayValue"),
                    "unit": grp.get("position"),
                    "headshot": (a.get("headshot") or {}).get("href"),
                })
    if not rows:
        return None
    df = pd.DataFrame(rows).drop_duplicates("player_id")
    transform.write_json(NCAA_DIR / "rosters.json", df.reset_index(drop=True))
    log.info("NCAA kadrolar yazıldı: %s oyuncu", len(df))
    return df


def build_next_schedule(season: int) -> pd.DataFrame | None:
    """Gelecek sezonun fikstürü (box score'suz) + yeni konferans eşlemeleri."""
    events = fetch_season_events(season)
    if not events:
        log.info("NCAA %s fikstürü henüz yayınlanmamış", season)
        return None
    sched, teams, conf_of = parse_schedule(events, season)
    confs = conference_names(season, set(conf_of.values()))
    _write_teams(teams, conf_of, confs)
    out = sched.drop(columns=["completed"])
    transform.write_json(NCAA_DIR / "next_schedule.json", out)
    log.info("NCAA %s fikstürü yazıldı: %s maç", season, len(out))
    return sched


# Pozisyona göre tahmin edilen statlar (NFL projeksiyonlarıyla aynı yaklaşım)
POS_PROJ = {
    "QB": ["completions", "attempts", "passing_yards", "passing_tds",
           "passing_interceptions", "carries", "rushing_yards"],
    "RB": ["carries", "rushing_yards", "rushing_tds",
           "receptions", "receiving_yards"],
    "WR": ["receptions", "receiving_yards", "receiving_tds"],
    "TE": ["receptions", "receiving_yards", "receiving_tds"],
}
PASS_STATS = {"completions", "attempts", "passing_yards", "passing_tds",
              "receptions", "receiving_yards", "receiving_tds"}


def build_projections(rosters: pd.DataFrame | None,
                      next_sched: pd.DataFrame | None) -> None:
    """Sezgisel haftalık projeksiyon: son sezon form ortalamaları ×
    rakibin geçen sezonki savunma çarpanı; güncel roster (transfer dahil)."""
    if rosters is None or next_sched is None:
        log.info("NCAA projeksiyon atlandı (kadro veya fikstür yok)")
        return
    hist = last_pw = None
    for sdir in sorted((NCAA_DIR / "seasons").glob("*"), reverse=True):
        last_pw = _read_existing(sdir / "player_weeks.json")
        if last_pw is not None and not last_pw.empty:
            hist = last_pw
            data_season = int(sdir.name)
            break
    if hist is None:
        return

    # Hedef hafta: fikstürdeki oynanmamış en erken hafta
    open_games = next_sched[~next_sched["completed"].fillna(False)]
    if open_games.empty:
        return
    reg_open = open_games[open_games["season_type"] == "REG"]
    pick = reg_open if not reg_open.empty else open_games
    tw_ = int(pick["week"].min())
    ts_ = int(pick["season"].iloc[0])
    games = pick[pick["week"] == tw_]
    opp_of, home_of = {}, {}
    for g in games.itertuples():
        opp_of[g.home_team], home_of[g.home_team] = g.away_team, True
        opp_of[g.away_team], home_of[g.away_team] = g.home_team, False

    # Geçen sezon takım başına izin verilen pas/koşu yardı çarpanları
    tw_hist = _read_existing(NCAA_DIR / "seasons" / str(data_season) / "team_weeks.json")
    pass_f, rush_f = {}, {}
    if tw_hist is not None and not tw_hist.empty:
        allowed = tw_hist.groupby("opponent")[["passing_yards", "rushing_yards"]].mean()
        lg = allowed.mean()
        for team, r in allowed.iterrows():
            pass_f[team] = min(1.15, max(0.85, r["passing_yards"] / lg["passing_yards"]))
            rush_f[team] = min(1.15, max(0.85, r["rushing_yards"] / lg["rushing_yards"]))

    stats_all = sorted({s for v in POS_PROJ.values() for s in v})
    # Kronolojik sıra: REG haftaları, ardından POST (bowl/playoff)
    hist = hist.assign(
        _ord=hist["week"] + (hist["season_type"] == "POST") * 100
    ).sort_values("_ord")
    g = hist.groupby("player_id")
    season_mean = g[stats_all].mean()
    last5_mean = g.tail(5).groupby("player_id")[stats_all].mean()
    games_ct = g.size()

    rows = []
    ros = rosters[rosters["position"].isin(SKILL_POS)]
    for p in ros.itertuples():
        opp = opp_of.get(p.team)
        if opp is None or p.player_id not in season_mean.index:
            continue
        if games_ct.get(p.player_id, 0) < 3:
            continue
        pos = "RB" if p.position == "FB" else p.position
        base = (0.6 * last5_mean.loc[p.player_id]
                + 0.4 * season_mean.loc[p.player_id])
        row = {"player_id": p.player_id, "player_name": p.player_name,
               "position": pos, "team": p.team, "opponent": opp,
               "is_home": bool(home_of.get(p.team))}
        for s in POS_PROJ.get(pos, POS_PROJ["WR"]):
            v = base.get(s)
            if v is None or pd.isna(v):
                continue
            f = pass_f.get(opp, 1.0) if s in PASS_STATS else rush_f.get(opp, 1.0)
            row[f"proj_{s}"] = round(float(v) * f, 1)
        rows.append(row)
    if not rows:
        return
    df = pd.DataFrame(rows)
    prim = (df.get("proj_passing_yards", pd.Series(0, index=df.index)).fillna(0)
            + df.get("proj_rushing_yards", pd.Series(0, index=df.index)).fillna(0)
            + df.get("proj_receiving_yards", pd.Series(0, index=df.index)).fillna(0))
    df = df.loc[prim.sort_values(ascending=False).index].reset_index(drop=True)

    df = df.astype(object).where(pd.notna(df), None)
    payload = {"generated_at": pd.Timestamp.utcnow().isoformat(),
               "data_season": data_season, "engine": "heuristic",
               "target": {"season": ts_, "week": tw_},
               "columns": list(df.columns),
               "rows": df.values.tolist()}
    with open(NCAA_DIR / "projections.json", "w") as f:
        json.dump(payload, f, ensure_ascii=False, allow_nan=False)
    log.info("NCAA projeksiyon yazıldı: %s oyuncu, hedef %s W%s",
             len(df), ts_, tw_)


EVAL_WEEKS = range(6, 16)  # REG W6-W15 geriye dönük test edilir


def _proj_base(hist: pd.DataFrame, stats_all: list[str]):
    """Canlı projeksiyonla aynı form ortalaması: 0.6×son5 + 0.4×sezon."""
    g = hist.sort_values("_ord").groupby("player_id")
    season_mean = g[stats_all].mean()
    last5 = g.tail(5).groupby("player_id")[stats_all].mean()
    return 0.6 * last5 + 0.4 * season_mean, g.size()


def _opp_factors(tw_hist: pd.DataFrame | None):
    pass_f, rush_f = {}, {}
    if tw_hist is not None and not tw_hist.empty:
        allowed = tw_hist.groupby("opponent")[["passing_yards", "rushing_yards"]].mean()
        lg = allowed.mean()
        for team, r in allowed.iterrows():
            pass_f[team] = min(1.15, max(0.85, r["passing_yards"] / lg["passing_yards"]))
            rush_f[team] = min(1.15, max(0.85, r["rushing_yards"] / lg["rushing_yards"]))
    return pass_f, rush_f


def evaluate_projections() -> None:
    """Karne: son sezonun W6-W15 haftaları için yalnızca önceki haftaların
    verisiyle projeksiyon üret, gerçekleşenle karşılaştır."""
    import numpy as np

    pw = tw = None
    for sdir in sorted((NCAA_DIR / "seasons").glob("*"), reverse=True):
        pw = _read_existing(sdir / "player_weeks.json")
        tw = _read_existing(sdir / "team_weeks.json")
        if pw is not None and not pw.empty:
            data_season = int(sdir.name)
            break
    if pw is None or pw.empty:
        return
    stats_all = sorted({s for v in POS_PROJ.values() for s in v})
    pw = pw.assign(_ord=pw["week"] + (pw["season_type"] == "POST") * 100)
    if tw is not None:
        tw = tw.assign(_ord=tw["week"] + (tw["season_type"] == "POST") * 100)

    weeks_out, players_out = [], []
    for w in EVAL_WEEKS:
        hist = pw[pw["_ord"] < w]
        act = pw[pw["_ord"] == w]
        if act.empty or hist.empty:
            continue
        base, cnt = _proj_base(hist, stats_all)
        pass_f, rush_f = _opp_factors(tw[tw["_ord"] < w] if tw is not None else None)

        detail = []
        for r in act.itertuples():
            pid = r.player_id
            if pid not in base.index or cnt.get(pid, 0) < 3:
                continue
            pos = "RB" if r.position == "FB" else str(r.position)
            row = {"player_id": pid, "player_name": r.player_name,
                   "position": pos, "team": r.team, "opponent": r.opponent,
                   "week": int(w)}
            for s in POS_PROJ.get(pos, POS_PROJ["WR"]):
                v = base.at[pid, s] if s in base.columns else None
                if v is None or pd.isna(v):
                    continue
                f = (pass_f if s in PASS_STATS else rush_f).get(r.opponent, 1.0)
                row[f"proj_{s}"] = round(float(v) * f, 1)
                av = getattr(r, s, None)
                row[f"act_{s}"] = None if av is None or pd.isna(av) else float(av)
            detail.append(row)
        if not detail:
            continue
        ddf = pd.DataFrame(detail)
        metrics = {}
        for s in stats_all:
            pc, ac = f"proj_{s}", f"act_{s}"
            if pc not in ddf.columns or ac not in ddf.columns:
                continue
            pair = ddf[[pc, ac]].dropna()
            if len(pair) < 5:
                continue
            diff = pair[pc] - pair[ac]
            corr = None
            if pair[pc].std() > 0 and pair[ac].std() > 0:
                corr = round(float(np.corrcoef(pair[pc], pair[ac])[0, 1]), 3)
            metrics[s] = {"n": int(len(pair)),
                          "mae": round(float(diff.abs().mean()), 2),
                          "bias": round(float(diff.mean()), 2),
                          "corr": corr}
        weeks_out.append({"week": int(w), "stats": metrics})
        players_out.extend(detail)

    if not weeks_out:
        return
    payload = {"generated_at": pd.Timestamp.utcnow().isoformat(),
               "data_season": data_season, "method": "heuristic",
               "weeks": weeks_out, "players": players_out}
    with open(NCAA_DIR / "proj_eval.json", "w") as f:
        json.dump(payload, f, ensure_ascii=False, allow_nan=False)
    log.info("NCAA karne yazıldı: %s hafta, %s oyuncu-hafta satırı",
             len(weeks_out), len(players_out))


def rebuild_index_and_manifest() -> None:
    frames = []
    seasons = []
    for sdir in sorted((NCAA_DIR / "seasons").glob("*")):
        ps = _read_existing(sdir / "player_season.json")
        if ps is not None and not ps.empty:
            frames.append(ps)
            seasons.append(int(sdir.name))
    if not frames:
        return
    allp = pd.concat(frames, ignore_index=True)
    g = allp.sort_values("season").groupby("player_id")
    idx = pd.DataFrame({
        "player_name": g["player_name"].last(),
        "position": g["position"].last(),
        "team": g["team"].last(),
        "headshot": g["headshot"].last(),
        "first_season": g["season"].min(),
        "last_season": g["season"].max(),
    }).reset_index()
    # Roster'dan gerçek pozisyon + güncel takım (hacim çıkarımını düzeltir)
    ros = _read_existing(NCAA_DIR / "rosters.json")
    if ros is not None and not ros.empty:
        cur = (ros.drop_duplicates("player_id")
               [["player_id", "position", "team"]]
               .rename(columns={"position": "roster_position",
                                "team": "current_team"}))
        idx = idx.merge(cur, on="player_id", how="left")
        idx["position"] = idx["roster_position"].where(
            idx["roster_position"].notna(), idx["position"])
        idx = idx.drop(columns=["roster_position"])
    transform.write_json(NCAA_DIR / "players" / "index.json", idx)
    manifest = {"generated_at": pd.Timestamp.utcnow().isoformat(),
                "seasons": {str(s): {} for s in seasons}}
    (NCAA_DIR / "manifest.json").parent.mkdir(parents=True, exist_ok=True)
    with open(NCAA_DIR / "manifest.json", "w") as f:
        json.dump(manifest, f, ensure_ascii=False)
    log.info("NCAA index: %s oyuncu, sezonlar: %s", len(idx), seasons)


def refresh_extras(season: int) -> None:
    """Kadrolar + yaklaşan fikstür + projeksiyonlar (her Salı tazelenir)."""
    ros = fetch_rosters()
    nxt = build_next_schedule(season + 1)
    if nxt is None:  # gelecek sezon yayınlanmadıysa mevcut sezonun kalanı
        nxt = build_next_schedule(season)
    build_projections(ros, nxt)
    evaluate_projections()


def backfill(seasons: list[int] | None = None) -> None:
    todo = seasons or NCAA_SEASONS
    for s in todo:
        build_season(s, incremental=True)
    refresh_extras(max(todo))
    rebuild_index_and_manifest()


def update_current(season: int) -> None:
    """Salı güncellemesi: aktif sezonu artımlı tazele (yoksa no-op)."""
    build_season(season, incremental=True)
    refresh_extras(season)
    rebuild_index_and_manifest()
