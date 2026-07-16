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
        rows.append({
            "game_id": str(e["id"]),
            "season": season,
            "week": e["_week"],
            "season_type": e["_season_type"],
            "gameday": str(e.get("date", ""))[:10],
            "name": e.get("shortName"),
            "home_team": home["abbr"], "away_team": away["abbr"],
            "home_score": home["score"], "away_score": away["score"],
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

    # Takım maç satırlarına skorları bağla
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
    transform.write_json(NCAA_DIR / "players" / "index.json", idx)
    manifest = {"generated_at": pd.Timestamp.utcnow().isoformat(),
                "seasons": {str(s): {} for s in seasons}}
    (NCAA_DIR / "manifest.json").parent.mkdir(parents=True, exist_ok=True)
    with open(NCAA_DIR / "manifest.json", "w") as f:
        json.dump(manifest, f, ensure_ascii=False)
    log.info("NCAA index: %s oyuncu, sezonlar: %s", len(idx), seasons)


def backfill(seasons: list[int] | None = None) -> None:
    for s in seasons or NCAA_SEASONS:
        build_season(s, incremental=True)
    rebuild_index_and_manifest()


def update_current(season: int) -> None:
    """Salı güncellemesi: aktif sezonu artımlı tazele (yoksa no-op)."""
    if build_season(season, incremental=True):
        rebuild_index_and_manifest()
