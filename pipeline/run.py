"""Pipeline CLI.

Kullanım:
    python run.py backfill --seasons 2021-2025   # geçmiş sezonları kur
    python run.py update                          # içinde bulunulan sezonu güncelle (Salı cron'u)
"""
import argparse
import logging
import sys
from datetime import date

import pandas as pd

import advanced
import agent
import config
import insights
import ncaa
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


def update_current_roster() -> "object | None":
    """Güncel sezon kadroları + derinlik şeması (2026 varsa o, yoksa mevcut sezon)."""
    cur = current_season()
    result = None
    for season in (cur + 1, cur):
        depth = sources.fetch_depth_charts(season)
        if depth is None:
            continue
        roster = sources.fetch_roster(season)
        dc = advanced.build_depth_chart(depth, roster, season)
        if not dc.empty:
            transform.write_json(config.DATA_DIR / "depth_charts.json", dc)
            log.info("Depth chart yazıldı: %s sezonu, %s satır", season, len(dc))
            result = roster if roster is not None else dc

            # Güncel takım haritası: roster (geniş kapsam) + depth chart birleşimi.
            # Projeksiyonlar YALNIZCA bu haritadaki oyuncuları kullanır.
            frames = []
            if roster is not None and "gsis_id" in roster.columns:
                r = roster[roster["gsis_id"].notna()]
                frames.append(r.rename(columns={"gsis_id": "player_id"})
                               [["player_id", "team"]])
            frames.append(dc[dc["player_id"].notna()][["player_id", "team"]])
            cur = (pd.concat(frames, ignore_index=True)
                     .drop_duplicates("player_id", keep="first"))
            cur["season"] = season
            transform.write_json(config.DATA_DIR / "current_teams.json", cur)
            log.info("Güncel takım haritası: %s oyuncu (%s)", len(cur), season)
            break
    if result is None:
        log.warning("Depth chart verisi bulunamadı")

    update_injuries()
    return result


def update_injuries() -> None:
    """Resmi sakatlık raporlarını çek ve yaz (yeni sezon yoksa son sezon)."""
    cur = current_season()
    for season in (cur + 1, cur):
        inj = sources.fetch_injuries(season)
        if inj is None:
            continue
        keep = [c for c in config.INJURY_COLS if c in inj.columns]
        inj = inj[keep].rename(columns={"gsis_id": "player_id",
                                        "full_name": "player_name"})
        transform.write_json(config.DATA_DIR / "injuries.json",
                             inj.reset_index(drop=True))
        log.info("Sakatlık raporları yazıldı: %s sezonu, %s satır", season, len(inj))
        return
    log.warning("Sakatlık raporu bulunamadı")


def kickoff_within(schedules, hours: float = 4.75) -> bool:
    """Önümüzdeki `hours` saat içinde başlayacak maç var mı? (ET -> UTC)"""
    from datetime import datetime, timedelta
    from zoneinfo import ZoneInfo

    et, utc = ZoneInfo("America/New_York"), ZoneInfo("UTC")
    now = datetime.now(tz=utc)
    cur = current_season()
    upcoming = schedules[schedules["season"].isin([cur, cur + 1])
                         & schedules["home_score"].isna()
                         & schedules["gameday"].notna()]
    for _, g in upcoming.iterrows():
        try:
            t = str(g.get("gametime") or "13:00")
            kick = datetime.strptime(f"{g['gameday']} {t}", "%Y-%m-%d %H:%M")
            kick = kick.replace(tzinfo=et).astimezone(utc)
        except (ValueError, TypeError):
            continue
        delta = (kick - now).total_seconds() / 3600
        if 0 <= delta <= hours:
            log.info("Yaklaşan maç: %s @ %s, kickoff'a %.1f saat",
                     g["away_team"], g["home_team"], delta)
            return True
    return False


def gameday_update() -> int:
    """Maç gününe 4/2 saat kala: yalnızca sakatlıkları tazele ve
    projeksiyon/insight'ları yeniden üret. Yaklaşan maç yoksa no-op."""
    schedules = sources.fetch_schedules()
    if not kickoff_within(schedules):
        log.info("4.75 saat içinde maç yok — güncelleme atlandı")
        return 0
    update_injuries()
    insights.build_and_write(schedules, run_eval=False)
    # Agent bilerek çalıştırılmıyor: haftalık bir köşe yazısı ve maç günü
    # cron'u Pazar günü altı kez tetikleniyor. Salı koşusunda üretilir.
    return 0


def rebuild_index_and_manifest(master, current_roster=None) -> None:
    season_dfs = {}
    for sdir in sorted((config.DATA_DIR / "seasons").glob("*")):
        ps = transform.read_json(sdir / "player_season.json")
        if ps is not None:
            season_dfs[int(sdir.name)] = ps
    idx = transform.build_players_index(season_dfs, master)
    # Güncel takım bilgisi (offseason transferleri dahil)
    if current_roster is not None:
        id_col = "gsis_id" if "gsis_id" in current_roster.columns else "player_id"
        team_col = "team" if "team" in current_roster.columns else None
        if team_col and id_col in current_roster.columns:
            cur = (current_roster.drop_duplicates(id_col)
                   [[id_col, team_col]]
                   .rename(columns={id_col: "player_id", team_col: "current_team"}))
            idx = idx.merge(cur, on="player_id", how="left")
    transform.write_json(config.DATA_DIR / "players" / "index.json", idx)
    transform.build_manifest(config.DATA_DIR)


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    ap = argparse.ArgumentParser()
    ap.add_argument("mode", choices=["backfill", "update", "gameday",
                                     "ncaa-backfill", "agent"])
    ap.add_argument("--seasons", default=None,
                    help="backfill için aralık, ör. 2021-2025")
    args = ap.parse_args()

    if args.mode == "gameday":
        return gameday_update()

    if args.mode == "agent":
        # Yalnızca haftalık köşe yazısını yeniden üret. Sezon dışında
        # "update" erken çıkıyor (nflverse'te yeni sezon dosyası yok), o
        # yüzden ajanı elle çalıştırmanın ayrı bir yolu gerekiyor.
        agent.build_and_write()
        return 0

    if args.mode == "ncaa-backfill":
        if args.seasons:
            start, end = (int(x) for x in args.seasons.split("-"))
            ncaa.backfill(list(range(start, end + 1)))
        else:
            ncaa.backfill()
        return 0

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

    current_roster = None

    def do_roster():
        nonlocal current_roster
        current_roster = update_current_roster()

    _optional("güncel kadro/depth chart", do_roster)
    rebuild_index_and_manifest(master, current_roster)
    _optional("insights", lambda: insights.build_and_write(schedules))
    _optional("nfl agent", agent.build_and_write)
    if args.mode == "update":
        _optional("ncaa güncellemesi",
                  lambda: ncaa.update_current(current_season()))
    if failed:
        log.warning("Tamamlandı ama şu sezonlar başarısız: %s", failed)
        return 1
    log.info("Pipeline başarıyla tamamlandı: %s", seasons)
    return 0


if __name__ == "__main__":
    sys.exit(main())
