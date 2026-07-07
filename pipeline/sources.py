"""Veri kaynaklarından ham DataFrame'leri indirir (nflverse öncelikli)."""
import io
import logging
import re
import time

import pandas as pd
import requests

import config

log = logging.getLogger(__name__)

_session = requests.Session()
_session.headers["User-Agent"] = "nfl-tracker-pipeline/1.0"


def _fetch_csv(url: str, usecols: list[str] | None = None) -> pd.DataFrame | None:
    try:
        resp = _session.get(url, timeout=300)
    except requests.RequestException as exc:
        log.warning("İndirme hatası %s: %s", url, exc)
        return None
    if resp.status_code != 200:
        log.warning("HTTP %s: %s", resp.status_code, url)
        return None
    compression = "gzip" if url.endswith(".gz") else None
    kwargs = {}
    if usecols is not None:
        wanted = set(usecols)
        kwargs["usecols"] = lambda c: c in wanted
    df = pd.read_csv(io.BytesIO(resp.content), compression=compression,
                     low_memory=False, **kwargs)
    log.info("OK %s satır <- %s", len(df), url)
    return df


def _fetch_first(templates: list[str], usecols: list[str] | None = None,
                 **fmt) -> pd.DataFrame | None:
    for tpl in templates:
        df = _fetch_csv(tpl.format(base=config.NFLVERSE_BASE, **fmt), usecols=usecols)
        if df is not None:
            return df
    return None


def fetch_player_weeks(season: int) -> pd.DataFrame:
    """Bir sezonun haftalık oyuncu istatistikleri (hücum+savunma+kicking)."""
    df = _fetch_first(config.PLAYER_WEEK_CANDIDATES, season=season)
    if df is not None:
        return df
    # Eski release: üç ayrı dosyayı birleştir
    frames = []
    for tpl in config.PLAYER_WEEK_LEGACY:
        part = _fetch_csv(tpl.format(base=config.NFLVERSE_BASE, season=season))
        if part is not None:
            frames.append(part)
    if not frames:
        raise RuntimeError(f"{season} sezonu için oyuncu istatistiği indirilemedi")
    return pd.concat(frames, ignore_index=True)


def fetch_team_weeks(season: int) -> pd.DataFrame | None:
    """Bir sezonun haftalık takım istatistikleri; yoksa None (türetilecek)."""
    return _fetch_first(config.TEAM_WEEK_CANDIDATES, season=season)


def fetch_players_master() -> pd.DataFrame | None:
    return _fetch_first(config.PLAYERS_MASTER_CANDIDATES)


def fetch_snap_counts(season: int) -> pd.DataFrame | None:
    return _fetch_first(config.SNAP_COUNTS_CANDIDATES, season=season)


def fetch_ngs(season: int, stat_type: str) -> pd.DataFrame | None:
    """Next Gen Stats: passing | rushing | receiving (haftalık, week=0 sezon toplamı).

    Sıra: nflverse sezon dosyası -> nflverse birleşik dosya -> NFL NGS API.
    """
    for tpl in config.NGS_CANDIDATES:
        df = _fetch_csv(tpl.format(base=config.NFLVERSE_BASE,
                                   season=season, stat_type=stat_type))
        if df is None:
            continue
        if "season" not in df.columns or (df["season"] == season).any():
            return df
        log.info("NGS %s: dosyada %s sezonu yok, sonraki kaynak", stat_type, season)
    log.info("NGS %s %s nflverse'te bulunamadı, NGS API deneniyor", stat_type, season)
    return _fetch_ngs_api(season, stat_type)


def _camel_to_snake(s: str) -> str:
    return re.sub(r"(?<!^)(?=[A-Z])", "_", s).lower()


def _fetch_ngs_api(season: int, stat_type: str) -> pd.DataFrame | None:
    """NFL NGS API'sinden hafta hafta çeker (week=0 sezon toplamı)."""
    rows: list[dict] = []
    skip_keys = {"season", "seasonType", "week", "teamAbbr"}
    for week in range(0, 19):
        url = config.NGS_API_URL.format(stat_type=stat_type, season=season)
        if week:
            url += f"&week={week}"
        try:
            resp = _session.get(url, headers=config.NGS_API_HEADERS, timeout=60)
        except requests.RequestException as exc:
            log.warning("NGS API hatası (%s w%s): %s", stat_type, week, exc)
            if week == 0:
                return None
            continue
        if resp.status_code != 200:
            log.warning("NGS API HTTP %s (%s w%s)", resp.status_code, stat_type, week)
            if week == 0:
                return None
            continue
        for item in resp.json().get("stats") or []:
            player = item.get("player") or {}
            flat = {
                "season": season, "season_type": "REG", "week": week,
                "player_gsis_id": player.get("gsisId") or item.get("gsisId"),
                "player_display_name": (player.get("displayName")
                                        or item.get("playerName")),
                "team_abbr": item.get("teamAbbr"),
            }
            for k, v in item.items():
                if k in skip_keys or not isinstance(v, (int, float, str)):
                    continue
                flat.setdefault(_camel_to_snake(k), v)
            rows.append(flat)
        time.sleep(0.25)
    if not rows:
        return None
    df = pd.DataFrame(rows)
    log.info("NGS API OK: %s %s -> %s satır", season, stat_type, len(df))
    return df


def fetch_pbp(season: int) -> pd.DataFrame | None:
    """Play-by-play (yalnızca gerekli kolonlar). Red zone ve advanced hesapları için."""
    return _fetch_first(config.PBP_CANDIDATES, usecols=config.PBP_USECOLS, season=season)


def fetch_participation(season: int) -> pd.DataFrame | None:
    """Savunma personel/coverage verisi (yalnızca ~2016-2023 mevcut)."""
    return _fetch_first(config.PARTICIPATION_CANDIDATES, season=season)


def fetch_ftn(season: int) -> pd.DataFrame | None:
    """FTN charting (2022+): blitz, pass rusher sayısı vb."""
    return _fetch_first(config.FTN_CANDIDATES, season=season)


def fetch_schedules() -> pd.DataFrame:
    for url in config.SCHEDULE_URLS:
        df = _fetch_csv(url)
        if df is not None:
            return df
    raise RuntimeError("Maç programı (games.csv) hiçbir kaynaktan indirilemedi")
