"""Pipeline CLI.

Kullanım:
    python run.py backfill --seasons 2021-2025   # geçmiş sezonları kur
    python run.py update                          # içinde bulunulan sezonu güncelle (Salı cron'u)
"""
import argparse
import logging
import sys
from datetime import date

import config
import sources
import transform

log = logging.getLogger("pipeline")


def current_season(today: date | None = None) -> int:
    """NFL sezonu Eylül'de başlar, Şubat'ta biter: Oca-Tem arası önceki yılın sezonudur."""
    today = today or date.today()
    return today.year if today.month >= 8 else today.year - 1


def process_season(season: int, schedules) -> None:
    log.info("=== %s sezonu işleniyor ===", season)
    raw_pw = sources.fetch_player_weeks(season)
    pw = transform.build_player_weeks(raw_pw, season)
    ps = transform.build_player_season(pw)
    tw = transform.build_team_weeks(sources.fetch_team_weeks(season), pw, season)
    sched = transform.build_schedule(schedules, season)
    ts = transform.build_team_season(tw, sched)

    sdir = config.DATA_DIR / "seasons" / str(season)
    transform.write_json(sdir / "player_weeks.json", pw)
    transform.write_json(sdir / "player_season.json", ps)
    transform.write_json(sdir / "team_weeks.json", tw)
    transform.write_json(sdir / "team_season.json", ts)
    transform.write_json(sdir / "schedule.json", sched)


def rebuild_index_and_manifest() -> None:
    season_dfs = {}
    for sdir in sorted((config.DATA_DIR / "seasons").glob("*")):
        ps = transform.read_json(sdir / "player_season.json")
        if ps is not None:
            season_dfs[int(sdir.name)] = ps
    master = sources.fetch_players_master()
    idx = transform.build_players_index(season_dfs, master)
    transform.write_json(config.DATA_DIR / "players" / "index.json", idx)
    transform.build_manifest(config.DATA_DIR)


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    ap = argparse.ArgumentParser()
    ap.add_argument("mode", choices=["backfill", "update"])
    ap.add_argument("--seasons", default=None,
                    help="backfill için aralık, ör. 2021-2025")
    args = ap.parse_args()

    if args.mode == "backfill":
        if args.seasons:
            start, end = (int(x) for x in args.seasons.split("-"))
            seasons = list(range(start, end + 1))
        else:
            seasons = config.BACKFILL_SEASONS
    else:
        seasons = [current_season()]

    schedules = sources.fetch_schedules()
    failed = []
    for season in seasons:
        try:
            process_season(season, schedules)
        except Exception:
            log.exception("%s sezonu işlenemedi", season)
            failed.append(season)

    if args.mode == "update" and failed:
        # Sezon henüz başlamamışsa nflverse'te dosya olmaz; cron'u kırma.
        log.warning("Güncellenecek veri yok (sezon başlamamış olabilir): %s", failed)
        return 0

    if len(failed) == len(seasons):
        log.error("Hiçbir sezon işlenemedi, çıkılıyor")
        return 1

    rebuild_index_and_manifest()
    if failed:
        log.warning("Tamamlandı ama şu sezonlar başarısız: %s", failed)
        return 1
    log.info("Pipeline başarıyla tamamlandı: %s", seasons)
    return 0


if __name__ == "__main__":
    sys.exit(main())
