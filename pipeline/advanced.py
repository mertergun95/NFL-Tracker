"""Play-by-play ve yardımcı kaynaklardan türetilen ileri istatistikler:
red zone, takım advanced (EPA/success), savunma şeması, snap counts, NGS, share'ler.
"""
import logging

import numpy as np
import pandas as pd

import config

log = logging.getLogger(__name__)


def _round(df: pd.DataFrame, nd: int = 3) -> pd.DataFrame:
    for c in df.select_dtypes(include=["float"]).columns:
        df[c] = df[c].round(nd)
    return df


# ---------------------------------------------------------------- red zone

def build_player_redzone(pbp: pd.DataFrame, names: pd.DataFrame) -> pd.DataFrame:
    """Oyuncu bazında red zone (yardline_100<=20) ve inside-10 istatistikleri (REG)."""
    rz = pbp[(pbp["season_type"] == "REG") & (pbp["yardline_100"] <= 20)]

    def grp(df, id_col, spec: dict) -> pd.DataFrame:
        g = df.groupby(id_col).agg(**spec).reset_index()
        return g.rename(columns={id_col: "player_id"})

    out = []
    for zone, cutoff in (("rz", 20), ("i10", 10)):
        z = rz[rz["yardline_100"] <= cutoff]
        rush = z[z["rush_attempt"] == 1]
        out.append(grp(rush, "rusher_player_id", {
            f"{zone}_carries": ("rush_attempt", "sum"),
            f"{zone}_rush_tds": ("rush_touchdown", "sum"),
        }))
        pas = z[z["pass_attempt"] == 1]
        out.append(grp(pas, "receiver_player_id", {
            f"{zone}_targets": ("pass_attempt", "sum"),
            f"{zone}_receptions": ("complete_pass", "sum"),
            f"{zone}_rec_tds": ("pass_touchdown", "sum"),
        }))
        out.append(grp(pas, "passer_player_id", {
            f"{zone}_pass_att": ("pass_attempt", "sum"),
            f"{zone}_pass_tds": ("pass_touchdown", "sum"),
            f"{zone}_pass_ints": ("interception", "sum"),
        }))

    merged = out[0]
    for df in out[1:]:
        merged = merged.merge(df, on="player_id", how="outer")
    merged = merged[merged["player_id"].notna()]
    for c in merged.columns:
        if c != "player_id":
            merged[c] = merged[c].fillna(0).astype(int)

    merged = names.merge(merged, on="player_id", how="right")
    total = (merged.get("rz_carries", 0) + merged.get("rz_targets", 0)
             + merged.get("rz_pass_att", 0))
    return merged[total > 0].reset_index(drop=True)


# ------------------------------------------------------------ takım advanced

def _team_side(pbp: pd.DataFrame, team_col: str, prefix: str) -> pd.DataFrame:
    """Bir taraf (hücum=posteam / savunma=defteam) için advanced metrikler."""
    plays = pbp[(pbp["season_type"] == "REG")
                & pbp["epa"].notna()
                & ((pbp["pass"] == 1) | (pbp["rush"] == 1))
                & (pbp["two_point_attempt"] != 1)]
    g = plays.groupby(team_col)
    out = pd.DataFrame({
        f"{prefix}_plays": g.size(),
        f"{prefix}_epa_play": g["epa"].mean(),
        f"{prefix}_success_rate": g["success"].mean(),
        f"{prefix}_pass_rate": g["pass"].mean(),
    })
    pas = plays[plays["pass"] == 1].groupby(team_col)
    rush = plays[plays["rush"] == 1].groupby(team_col)
    out[f"{prefix}_pass_epa"] = pas["epa"].mean()
    out[f"{prefix}_rush_epa"] = rush["epa"].mean()
    out[f"{prefix}_sack_rate"] = pas["sack"].mean()
    expl = plays.assign(explosive=lambda d: (
        ((d["pass"] == 1) & (d["yards_gained"] >= 20))
        | ((d["rush"] == 1) & (d["yards_gained"] >= 10))).astype(float))
    out[f"{prefix}_explosive_rate"] = expl.groupby(team_col)["explosive"].mean()
    third = plays[plays["down"] == 3].groupby(team_col)
    out[f"{prefix}_third_down_conv"] = third["first_down"].mean()

    # Red zone verimi: RZ'ye giren drive başına TD oranı
    reg = pbp[pbp["season_type"] == "REG"]
    drives = (reg.groupby([team_col, "game_id", "fixed_drive"])
                 .agg(min_yl=("yardline_100", "min"),
                      result=("fixed_drive_result", "first"))
                 .reset_index())
    rz_drives = drives[drives["min_yl"] <= 20].groupby(team_col)
    out[f"{prefix}_rz_td_pct"] = rz_drives["result"].apply(
        lambda s: (s == "Touchdown").mean())

    turnovers = reg.assign(to=lambda d: (
        (d["interception"] == 1) | (d["fumble_lost"] == 1)).astype(int))
    out[f"{prefix}_turnovers"] = turnovers.groupby(team_col)["to"].sum()
    return out


def build_team_advanced(pbp: pd.DataFrame) -> pd.DataFrame:
    off = _team_side(pbp, "posteam", "off")
    deff = _team_side(pbp, "defteam", "def")
    out = off.join(deff, how="outer").reset_index().rename(columns={"index": "team"})
    if "posteam" in out.columns:
        out = out.rename(columns={"posteam": "team"})
    return _round(out)


# --------------------------------------------------------- savunma şeması

def build_team_scheme(pbp: pd.DataFrame,
                      participation: pd.DataFrame | None,
                      ftn: pd.DataFrame | None) -> pd.DataFrame | None:
    """Savunma şeması profili: man/zone oranı, coverage'a göre EPA, blitz, box."""
    frames = []

    if participation is not None and "defense_man_zone_type" in participation.columns:
        gid = "nflverse_game_id" if "nflverse_game_id" in participation.columns else "game_id"
        p = participation.rename(columns={gid: "game_id"})
        join = pbp[["game_id", "play_id", "defteam", "epa", "pass",
                    "season_type"]].merge(
            p[["game_id", "play_id", "defense_man_zone_type",
               "defenders_in_box", "number_of_pass_rushers"]],
            on=["game_id", "play_id"], how="inner")
        join = join[join["season_type"] == "REG"]
        cov = join[(join["pass"] == 1) & join["defense_man_zone_type"].notna()]
        g = cov.groupby("defteam")
        part = pd.DataFrame({
            "man_rate": g["defense_man_zone_type"].apply(
                lambda s: (s == "MAN_COVERAGE").mean()),
            "zone_rate": g["defense_man_zone_type"].apply(
                lambda s: (s == "ZONE_COVERAGE").mean()),
            "epa_vs_man": cov[cov["defense_man_zone_type"] == "MAN_COVERAGE"]
                .groupby("defteam")["epa"].mean(),
            "epa_vs_zone": cov[cov["defense_man_zone_type"] == "ZONE_COVERAGE"]
                .groupby("defteam")["epa"].mean(),
            "blitz_rate": cov.assign(b=lambda d: (
                pd.to_numeric(d["number_of_pass_rushers"], errors="coerce") >= 5
            ).astype(float)).groupby("defteam")["b"].mean(),
            "avg_box": join.groupby("defteam")["defenders_in_box"].mean(),
        })
        frames.append(part)

    if ftn is not None and "n_blitzers" in ftn.columns:
        gid = "nflverse_game_id" if "nflverse_game_id" in ftn.columns else "game_id"
        pid = "nflverse_play_id" if "nflverse_play_id" in ftn.columns else "play_id"
        f = ftn.rename(columns={gid: "game_id", pid: "play_id"})
        join = pbp[["game_id", "play_id", "defteam", "pass", "season_type"]].merge(
            f[["game_id", "play_id", "n_blitzers", "n_pass_rushers"]],
            on=["game_id", "play_id"], how="inner")
        join = join[(join["season_type"] == "REG") & (join["pass"] == 1)]
        g = join.groupby("defteam")
        frames.append(pd.DataFrame({
            "blitz_rate_ftn": g["n_blitzers"].apply(
                lambda s: (pd.to_numeric(s, errors="coerce") > 0).mean()),
            "avg_pass_rushers": g["n_pass_rushers"].mean(),
        }))

    if not frames:
        return None
    out = frames[0]
    for df in frames[1:]:
        out = out.join(df, how="outer")
    return _round(out.reset_index().rename(columns={"defteam": "team"}))


# ------------------------------------------------------------- snap counts

def build_snap_counts(raw: pd.DataFrame, master: pd.DataFrame | None,
                      season: int) -> pd.DataFrame:
    df = raw[raw["season"] == season].copy() if "season" in raw.columns else raw.copy()
    # pfr id -> gsis id eşlemesi
    df["player_id"] = None
    if master is not None:
        pfr_col = next((c for c in ("pfr_id", "pfr_player_id") if c in master.columns), None)
        if pfr_col and "pfr_player_id" in df.columns:
            m = master[[pfr_col, "gsis_id"]].dropna().drop_duplicates(pfr_col)
            df = df.drop(columns=["player_id"]).merge(
                m.rename(columns={pfr_col: "pfr_player_id", "gsis_id": "player_id"}),
                on="pfr_player_id", how="left")
            rate = df["player_id"].notna().mean()
            log.info("Snap counts gsis eşleşme oranı: %.1f%%", rate * 100)
    keep = [c for c in config.SNAP_COUNT_COLS if c in df.columns]
    df = df[keep]
    if "game_type" in df.columns:
        df = df[df["game_type"].isin(["REG", "POST", "WC", "DIV", "CON", "SB"])]
    return _round(df.reset_index(drop=True), 2)


# -------------------------------------------------------------------- NGS

def build_ngs(raw: pd.DataFrame, stat_type: str, season: int) -> pd.DataFrame:
    df = raw[raw["season"] == season].copy() if "season" in raw.columns else raw.copy()
    if "season_type" in df.columns:
        df = df[df["season_type"].isin(["REG", "POST"])]
    keep = [c for c in config.NGS_COLS[stat_type] if c in df.columns]
    missing = [c for c in config.NGS_COLS[stat_type] if c not in df.columns]
    if missing:
        log.info("NGS %s eksik kolonlar: %s", stat_type, missing)
    df = df[keep].rename(columns={"player_gsis_id": "player_id",
                                  "player_display_name": "player_name",
                                  "team_abbr": "team"})
    return _round(df.reset_index(drop=True), 2)


# ------------------------------------------------------------ depth chart

def build_depth_chart(raw: pd.DataFrame, roster: pd.DataFrame | None,
                      season: int) -> pd.DataFrame:
    """Güncel derinlik şeması: takım × pozisyon × öncelik sırası (son snapshot)."""
    df = raw.copy()
    renames = {"club_code": "team", "depth_team": "depth",
               "gsis_id": "player_id", "full_name": "player_name",
               "jersey_number": "jersey", "depth_position": "position_slot"}
    # hedef kolon zaten varsa kaynağı at (duplicate kolon kaymasını önle)
    df = df.drop(columns=[k for k, v in renames.items()
                          if k in df.columns and v in df.columns])
    df = df.rename(columns={k: v for k, v in renames.items() if k in df.columns})
    if "player_name" not in df.columns:
        if {"first_name", "last_name"} <= set(df.columns):
            df["player_name"] = (df["first_name"].astype(str) + " "
                                 + df["last_name"].astype(str)).str.strip()
        else:
            df["player_name"] = df.get("football_name", "")

    # takım başına en güncel snapshot (hafta ya da tarih kolonu üzerinden)
    for time_col in ("week", "dt"):
        if time_col in df.columns and df[time_col].notna().any() and "team" in df.columns:
            latest = df.groupby("team")[time_col].transform("max")
            df = df[df[time_col] == latest]
            break

    log.info("Depth chart ham kolonlar: %s", list(raw.columns))
    keep = [c for c in ("team", "formation", "position", "position_slot",
                        "depth", "jersey", "player_id", "player_name")
            if c in df.columns]
    if not {"team", "position", "depth"} <= set(keep):
        log.warning("Depth chart beklenen kolonları içermiyor: %s", keep)
        return pd.DataFrame()
    df = df[keep].copy()
    df["depth"] = pd.to_numeric(df["depth"], errors="coerce")
    df = df[df["depth"].notna()]
    df["depth"] = df["depth"].astype(int)
    dedup = [c for c in ("team", "formation", "position", "depth", "player_id")
             if c in df.columns]
    df = df.drop_duplicates(dedup, keep="first")

    if roster is not None and "gsis_id" in roster.columns:
        extra = [c for c in ("status", "headshot_url") if c in roster.columns]
        if extra:
            r = roster.drop_duplicates("gsis_id")[["gsis_id", *extra]]
            df = df.merge(r.rename(columns={"gsis_id": "player_id"}),
                          on="player_id", how="left")
    df["season"] = season
    order = [c for c in ("team", "formation", "position") if c in df.columns]
    return df.sort_values([*order, "depth"]).reset_index(drop=True)

SHARE_SPECS = [
    # (oyuncu kolonu, takım kolonu, çıktı adı)
    ("carries", "carries", "carry_share"),
    ("targets", "targets", "target_share_calc"),
    ("rushing_yards", "rushing_yards", "rush_yds_share"),
    ("receiving_yards", "receiving_yards", "rec_yds_share"),
]


def add_weekly_shares(pw: pd.DataFrame, tw: pd.DataFrame) -> pd.DataFrame:
    """Oyuncu-hafta satırlarına takım toplamına göre pay kolonları ekler."""
    keys = ["team", "season", "week", "season_type"]
    team_cols = list({t for _, t, _ in SHARE_SPECS} & set(tw.columns))
    if not all(k in tw.columns for k in keys) or not team_cols:
        return pw
    t = tw[keys + team_cols].rename(columns={c: f"tm_{c}" for c in team_cols})
    out = pw.merge(t, on=keys, how="left")
    for pcol, tcol, name in SHARE_SPECS:
        if pcol in out.columns and f"tm_{tcol}" in out.columns:
            denom = out[f"tm_{tcol}"].replace(0, np.nan)
            out[name] = (out[pcol] / denom).round(3)
    return out.drop(columns=[f"tm_{c}" for c in team_cols])


def season_shares(pw_with_shares: pd.DataFrame, tw: pd.DataFrame) -> pd.DataFrame:
    """Sezonluk pay: oyuncunun toplamı / oynadığı haftalardaki takım toplamı (REG)."""
    keys = ["team", "season", "week", "season_type"]
    reg = pw_with_shares[pw_with_shares["season_type"] == "REG"]
    team_cols = list({t for _, t, _ in SHARE_SPECS} & set(tw.columns))
    t = tw[keys + team_cols].rename(columns={c: f"tm_{c}" for c in team_cols})
    j = reg.merge(t, on=keys, how="left")
    rows = []
    for pid, g in j.groupby("player_id"):
        row = {"player_id": pid}
        for pcol, tcol, name in SHARE_SPECS:
            if pcol in g.columns and f"tm_{tcol}" in g.columns:
                denom = g[f"tm_{tcol}"].sum()
                row[name] = round(g[pcol].sum() / denom, 3) if denom else None
        rows.append(row)
    return pd.DataFrame(rows)
