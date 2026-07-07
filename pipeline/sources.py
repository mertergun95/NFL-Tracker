"""Veri kaynaklarından ham DataFrame'leri indirir (nflverse öncelikli)."""
import io
import logging

import pandas as pd
import requests

import config

log = logging.getLogger(__name__)

_session = requests.Session()
_session.headers["User-Agent"] = "nfl-tracker-pipeline/1.0"


def _fetch_csv(url: str) -> pd.DataFrame | None:
    try:
        resp = _session.get(url, timeout=120)
    except requests.RequestException as exc:
        log.warning("İndirme hatası %s: %s", url, exc)
        return None
    if resp.status_code != 200:
        log.warning("HTTP %s: %s", resp.status_code, url)
        return None
    compression = "gzip" if url.endswith(".gz") else None
    df = pd.read_csv(io.BytesIO(resp.content), compression=compression, low_memory=False)
    log.info("OK %s satır <- %s", len(df), url)
    return df


def _fetch_first(templates: list[str], **fmt) -> pd.DataFrame | None:
    for tpl in templates:
        df = _fetch_csv(tpl.format(base=config.NFLVERSE_BASE, **fmt))
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


def fetch_schedules() -> pd.DataFrame:
    for url in config.SCHEDULE_URLS:
        df = _fetch_csv(url)
        if df is not None:
            return df
    raise RuntimeError("Maç programı (games.csv) hiçbir kaynaktan indirilemedi")
