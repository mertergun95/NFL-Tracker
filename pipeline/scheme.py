"""Oyuncuların hücum şeması/bağlam splitleri (pbp + FTN charting).

Splitler:
- QB (dropback):   play action / normal, blitze karşı / blitzsiz, shotgun / under center
- RB (koşu):       shotgun / under center, 8+ box / hafif box
- Hedef (target):  play action, screen, blitze karşı

Çıktı: uzun format — player_id, unit, split, plays, yards, tds, ints, epa_play, success_rate
"""
import logging

import pandas as pd

log = logging.getLogger(__name__)

MIN_PLAYS = 8


def _join_ftn(pbp: pd.DataFrame, ftn: pd.DataFrame | None) -> pd.DataFrame:
    reg = pbp[pbp["season_type"] == "REG"].copy()
    if ftn is None:
        return reg
    gid = "nflverse_game_id" if "nflverse_game_id" in ftn.columns else "game_id"
    pid = "nflverse_play_id" if "nflverse_play_id" in ftn.columns else "play_id"
    cols = [c for c in ("is_play_action", "is_screen_pass", "n_blitzers",
                        "n_defense_box") if c in ftn.columns]
    if not cols:
        return reg
    f = ftn.rename(columns={gid: "game_id", pid: "play_id"})
    f = f[["game_id", "play_id", *cols]]
    return reg.merge(f, on=["game_id", "play_id"], how="left")


def _agg(sub: pd.DataFrame, id_col: str, unit: str, split: str) -> pd.DataFrame:
    if sub.empty:
        return pd.DataFrame()
    g = sub.groupby(id_col)
    out = pd.DataFrame({
        "plays": g.size(),
        "yards": g["yards_gained"].sum(),
        "tds": g["touchdown"].sum(),
        "ints": g["interception"].sum(),
        "epa_play": g["epa"].mean(),
        "success_rate": g["success"].mean(),
    }).reset_index().rename(columns={id_col: "player_id"})
    out = out[out["plays"] >= MIN_PLAYS]
    out["unit"] = unit
    out["split"] = split
    return out


def _truthy(s: pd.Series) -> pd.Series:
    """FTN boolean kolonları TRUE/FALSE string ya da 0/1 gelebilir."""
    if s.dtype == bool:
        return s.fillna(False)
    return s.astype(str).str.upper().isin(["TRUE", "1", "1.0"])


def build_player_scheme(pbp: pd.DataFrame, ftn: pd.DataFrame | None,
                        names: pd.DataFrame) -> pd.DataFrame:
    df = _join_ftn(pbp, ftn)
    df = df[df["epa"].notna() & (df["two_point_attempt"] != 1)]
    has_ftn = "is_play_action" in df.columns

    dropbacks = df[df["pass"] == 1]
    rushes = df[df["rush"] == 1]
    targets = dropbacks[dropbacks["pass_attempt"] == 1]

    frames = []

    # QB splitleri
    if has_ftn:
        pa = _truthy(dropbacks["is_play_action"])
        frames.append(_agg(dropbacks[pa], "passer_player_id", "QB", "play_action"))
        frames.append(_agg(dropbacks[~pa], "passer_player_id", "QB", "no_play_action"))
        blitz = pd.to_numeric(dropbacks.get("n_blitzers"), errors="coerce") > 0
        frames.append(_agg(dropbacks[blitz], "passer_player_id", "QB", "vs_blitz"))
        frames.append(_agg(dropbacks[~blitz], "passer_player_id", "QB", "no_blitz"))
    sg = dropbacks["shotgun"] == 1
    frames.append(_agg(dropbacks[sg], "passer_player_id", "QB", "shotgun"))
    frames.append(_agg(dropbacks[~sg], "passer_player_id", "QB", "under_center"))

    # RB koşu splitleri
    rsg = rushes["shotgun"] == 1
    frames.append(_agg(rushes[rsg], "rusher_player_id", "RUSH", "shotgun"))
    frames.append(_agg(rushes[~rsg], "rusher_player_id", "RUSH", "under_center"))
    if has_ftn and "n_defense_box" in df.columns:
        box = pd.to_numeric(rushes["n_defense_box"], errors="coerce")
        frames.append(_agg(rushes[box >= 8], "rusher_player_id", "RUSH", "heavy_box"))
        frames.append(_agg(rushes[box < 8], "rusher_player_id", "RUSH", "light_box"))

    # Hedef (receiver) splitleri
    if has_ftn:
        tpa = _truthy(targets["is_play_action"])
        frames.append(_agg(targets[tpa], "receiver_player_id", "TGT", "play_action"))
        scr = _truthy(targets["is_screen_pass"])
        frames.append(_agg(targets[scr], "receiver_player_id", "TGT", "screen"))
        tbl = pd.to_numeric(targets.get("n_blitzers"), errors="coerce") > 0
        frames.append(_agg(targets[tbl], "receiver_player_id", "TGT", "vs_blitz"))

    frames = [f for f in frames if not f.empty]
    if not frames:
        return pd.DataFrame()
    out = pd.concat(frames, ignore_index=True)
    out = out[out["player_id"].notna()]
    out = names.merge(out, on="player_id", how="right")
    for c in ("epa_play", "success_rate"):
        out[c] = out[c].round(3)
    for c in ("yards", "tds", "ints"):
        out[c] = out[c].fillna(0).astype(int)
    log.info("Oyuncu şema splitleri: %s satır (FTN: %s)", len(out), has_ftn)
    return out.reset_index(drop=True)
