"""Pipeline CLI.

Kullanım:
    python run.py backfill --seasons 2021-2025   # geçmiş sezonları kur
    python run.py update                          # içinde bulunulan sezonu güncelle (Salı cron'u)
"""
import argparse
import logging
import sys
from datetime import date

import advanced
import config
import insights
import scheme
import sources
import transform

log = logging.getLogger("pipeline")


def current_season(today: date | None = None) -> int:
    """NFL sezonu Eylül'de başlar, Şubat'ta biter: Oca-Tem arası önceki yılın sezonudur."""
    today = today or date.today()
    return today.year if today.month >= 8 else today.year - 1


def _optional(name: str, fn) -> None:
    """Opsiyonel veri seti: hata olursa logla ama sezonu düşürme."""
    try:
        fn()
    except Exception:
        log.exception("Opsiyonel veri seti üretilemedi: %s", name)


def process_season(season: int, schedules, master) -> None:
    log.info("=== %s sezonu işleniyor ===", season)
    raw_pw = sources.fetch_player_weeks(season)
    pw = transform.build_player_weeks(raw_pw, season)
    ps = transform.build_player_season(pw)
    tw = transform.build_team_weeks(sources.fetch_team_weeks(season), pw, season)
    sched = transform.build_schedule(schedules, season)
    ts = transform.build_team_season(tw, sched)

    # Takım toplamına göre pay kolonları (haftalık + sezonluk)
    pw_shared = advanced.add_weekly_shares(pw, tw)
    try:
        shares = advanced.season_shares(pw_shared, tw)
        ps = ps.merge(shares, on="player_id", how="left")
    except Exception:
        log.exception("Sezonluk share hesabı başarısız")

    sdir = config.DATA_DIR / "seasons" / str(season)
    transform.write_json(sdir / "player_weeks.json", pw_shared)
    transform.write_json(sdir / "player_season.json", ps)
    transform.write_json(sdir / "team_weeks.json", tw)
    transform.write_json(sdir / "team_season.json", ts)
    transform.write_json(sdir / "schedule.json", sched)

    names = ps[["player_id", "player_name", "position", "team"]]

    def do_pbp():
        pbp = sources.fetch_pbp(season)
        if pbp is None:
            log.warning("%s pbp yok, red zone/advanced atlandı", season)
            return
        transform.write_json(sdir / "player_redzone.json",
                             advanced.build_player_redzone(pbp, names))
        transform.write_json(sdir / "team_advanced.json",
                             advanced.build_team_advanced(pbp))
        ftn = sources.fetch_ftn(season)
        team_scheme = advanced.build_team_scheme(
            pbp, sources.fetch_participation(season), ftn)
        if team_scheme is not None:
            transform.write_json(sdir / "team_scheme.json", team_scheme)
        else:
            log.warning("%s için şema verisi (participation/FTN) yok", season)
        player_scheme = scheme.build_player_scheme(pbp, ftn, names)
        if not player_scheme.empty:
            transform.write_json(sdir / "player_scheme.json", player_scheme)

    def do_snaps():
        raw = sources.fetch_snap_counts(season)
        if raw is not None:
            transform.write_json(sdir / "snap_counts.json",
                                 advanced.build_snap_counts(raw, master, season))

    def do_ngs():
        for stat_type in ("passing", "rushing", "receiving"):
            raw = sources.fetch_ngs(season, stat_type)
            if raw is not None:
                transform.write_json(sdir / f"ngs_{stat_type}.json",
                                     advanced.build_ngs(raw, stat_type, season))

    _optional("pbp (red zone / team advanced / şema)", do_pbp)
    _optional("snap counts", do_snaps)
    _optional("next gen stats", do_ngs)


def rebuild_index_and_manifest(master) -> None:
    season_dfs = {}
    for sdir in sorted((config.DATA_DIR / "seasons").glob("*")):
        ps = transform.read_json(sdir / "player_season.json")
        if ps is not None:
            season_dfs[int(sdir.name)] = ps
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
    master = sources.fetch_players_master()
    failed = []
    for season in seasons:
        try:
            process_season(season, schedules, master)
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

    rebuild_index_and_manifest(master)
    _optional("insights", lambda: insights.build_and_write(schedules))
    if failed:
        log.warning("Tamamlandı ama şu sezonlar başarısız: %s", failed)
        return 1
    log.info("Pipeline başarıyla tamamlandı: %s", seasons)
    return 0


if __name__ == "__main__":
    sys.exit(main())
