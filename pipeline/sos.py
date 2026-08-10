"""PFF fantezi fikstür zorluğu (strength of schedule) — yalnızca NFL.

Kaynak `pipeline/data/sos/{qb,rb,wr,te,dst}.csv`: PFF'den indirilen, pozisyon
başına takım × hafta tablosu. Otomatik çekilemiyor (halka açık uç yok), o
yüzden repoda duruyor ve sezon başında elle güncelleniyor.

Ölçek 0-10 ve **yüksek = kolay maç**. Bu yönü tahmin etmedik, ölçtük:
haftalık SOS değeri ile o hafta karşılaşılacak rakibin savunma reytingi
arasındaki korelasyon -0.48 (n=512) — yani SOS yükseldikçe rakip savunma
zayıflıyor.

PFF takım kısaltmaları nflverse'ünkilerden dört yerde ayrılıyor
(ARZ/BLT/CLV/HST); eşleme aşağıda, eksik kalan olursa yazma aşaması hata
veriyor ki sessizce yanlış takıma bağlanmasın.

Çıktı: web/public/data/sos.json
"""
import csv
import json
import logging
from datetime import datetime, timezone

import numpy as np
import pandas as pd

import config

log = logging.getLogger(__name__)

SOS_DIR = config.REPO_ROOT / "pipeline" / "data" / "sos"
POSITIONS = ["QB", "RB", "WR", "TE", "DST"]
WEEKS = list(range(1, 18))

# PFF -> nflverse kısaltması
PFF_TEAMS = {"ARZ": "ARI", "BLT": "BAL", "CLV": "CLE", "HST": "HOU"}

SCALE_NOTE = "0-10, higher = easier matchup"


def _f(v):
    if v is None or v == "":
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return None if np.isnan(f) else round(f, 2)


def _read_one(pos: str) -> pd.DataFrame:
    path = SOS_DIR / f"{pos.lower()}.csv"
    if not path.exists():
        log.warning("SOS dosyası yok: %s", path.name)
        return pd.DataFrame()
    with open(path, newline="") as f:
        rows = list(csv.reader(f))
    if len(rows) < 2:
        return pd.DataFrame()

    header = rows[0]
    idx = {name: i for i, name in enumerate(header)}
    out = []
    for r in rows[1:]:
        if not r or not r[0]:
            continue
        team = PFF_TEAMS.get(r[0], r[0])
        rec = {"team": team, "position": pos}
        for wk in WEEKS:
            col = idx.get(str(wk))
            # Bye haftası boş gelir -> None kalır
            rec[f"w{wk}"] = _f(r[col]) if col is not None else None
        rec["season_sos"] = _f(r[idx["Season SOS"]]) if "Season SOS" in idx else None
        rec["playoffs_sos"] = (_f(r[idx["Playoffs SOS"]])
                               if "Playoffs SOS" in idx else None)
        rec["all_sos"] = _f(r[idx["All SOS"]]) if "All SOS" in idx else None
        out.append(rec)
    df = pd.DataFrame(out)
    # Sezon geneli sırası: 1 = en kolay fikstür
    df["season_rank"] = df["season_sos"].rank(ascending=False, method="min")
    df["season_rank"] = df["season_rank"].astype("Int64")
    return df


def load() -> pd.DataFrame:
    """Tüm pozisyonları tek tabloda birleştirir."""
    frames = [d for d in (_read_one(p) for p in POSITIONS) if not d.empty]
    return pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()


def lookup(df: pd.DataFrame) -> dict:
    """(takım, pozisyon) -> {"season": x, "season_rank": n, "weeks": {hafta: x}}

    Ajan ve arayüz bu sözlükle tek maçlık değere ulaşıyor.
    """
    out = {}
    for r in df.itertuples():
        weeks = {wk: getattr(r, f"w{wk}") for wk in WEEKS
                 if getattr(r, f"w{wk}", None) is not None}
        out[(str(r.team), str(r.position))] = {
            "season": r.season_sos,
            "season_rank": None if pd.isna(r.season_rank) else int(r.season_rank),
            "weeks": weeks,
        }
    return out


def build_and_write(season: int | None = None) -> pd.DataFrame:
    df = load()
    if df.empty:
        log.warning("SOS verisi bulunamadı, sos.json yazılmadı")
        return df

    missing = sorted(set(df["team"]) - set(_known_teams()))
    if missing:
        # Sessizce yanlış takıma bağlamaktansa görünür ol
        log.error("SOS: eşleşmeyen takım kısaltmaları: %s", missing)

    cols = (["team", "position"] + [f"w{w}" for w in WEEKS]
            + ["season_sos", "season_rank", "playoffs_sos", "all_sos"])
    safe = df[cols].astype(object).where(pd.notna(df[cols]), None)
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": "PFF fantasy strength of schedule",
        "scale": SCALE_NOTE,
        "season": season,
        "weeks": WEEKS,
        "positions": POSITIONS,
        "columns": cols,
        "rows": safe.values.tolist(),
    }
    path = config.DATA_DIR / "sos.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"),
                  allow_nan=False)
    log.info("SOS yazıldı: %s satır (%s pozisyon)",
             len(df), df["position"].nunique())
    return df


def _known_teams() -> set:
    """Fikstürdeki takım kısaltmaları (eşleme denetimi için)."""
    path = config.DATA_DIR / "next_schedule.json"
    if not path.exists():
        return set()
    with open(path) as f:
        d = json.load(f)
    i = {c: n for n, c in enumerate(d["columns"])}
    teams = set()
    for row in d["rows"]:
        teams.add(row[i["home_team"]])
        teams.add(row[i["away_team"]])
    return teams
