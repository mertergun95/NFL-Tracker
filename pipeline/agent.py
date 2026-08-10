"""NFL Agent: haftalık boom/bust listesi + bülten (Faz 6).

Tasarım ilkesi: **sinyali Python üretir, anlatıyı Claude yazar.**

Modelin gördüğü her sayı burada hesaplanır ve "kanıt paketi" olarak
gönderilir; sitede gösterilen sayılar da doğrudan bu paketten gelir. Böylece
model istatistik uyduramaz — yalnızca elindeki rakamları yorumlar.

Akış:
    1. Aday havuzu   -> oynatılabilir derinlikte, projeksiyonu olan oyuncular
    2. Sinyaller     -> form, kullanım, snap, matchup, bant simetrisi, sakatlık
    3. Puanlama      -> boom_score / bust_score (z-skor ağırlıklı toplam)
    4. Seçim         -> her listeden 8 isim; takım başına ≤2, pozisyon başına ≤4
    5. Anlatı        -> Claude (JSON şemasıyla kısıtlı), İngilizce
    6. Karne         -> geçen haftaların çağrıları gerçek sonuçlarla kıyaslanır

Ayrıntılı belge: docs/AGENT.md

Çıktı: web/public/data/agent.json

ANTHROPIC_API_KEY yoksa ya da API çağrısı düşerse kural tabanlı metinle
yazılır; Salı cron'u bu yüzden kırılmaz.
"""
import json
import logging
import os
from datetime import datetime, timezone

import numpy as np
import pandas as pd

import config
import transform

log = logging.getLogger(__name__)

MODEL = "claude-opus-5"
MAX_TOKENS = 12000

MIN_PROJ_PPR = 6.0      # bu eşiğin altındaki projeksiyonlar aday değil
MIN_GAMES = 3           # sinyal için gereken en az maç sayısı
FORM_WINDOW = 3         # "son N hafta" penceresi
PICKS_PER_LIST = 8
MAX_PER_TEAM = 2        # bir listede aynı takımdan en fazla kaç isim
MAX_PER_POS = 4         # liste tek pozisyonla dolmasın
HISTORY_WEEKS = 10      # karnede tutulan hafta sayısı

# Fantezi ilgisi olan derinlik: bunun dışındaki isimler için boom/bust çağrısı
# kimseye bir şey söylemez (RB4'ün patlaması haber değil).
STARTABLE_RANK = {"QB": 20, "RB": 36, "WR": 48, "TE": 18}

# Karne eşikleri: çağrı, gerçekleşen PPR projeksiyonun bu katını aşarsa
# (boom) / altında kalırsa (bust) isabet sayılır. Tavan/taban yerine oran
# kullanılıyor çünkü model tabanı sık sık 0.0'a kırpıyor ve o eşik
# neredeyse hiç tutmuyor.
BOOM_RATIO = 1.35
BUST_RATIO = 0.65

SKILL_POS = ["QB", "RB", "WR", "TE"]


# --------------------------------------------------------------- yardımcılar

def _z(s: pd.Series) -> pd.Series:
    """Z-skor. Sabit seride (std=0) sıfır döner, NaN üretmez."""
    s = pd.to_numeric(s, errors="coerce")
    std = s.std(ddof=0)
    if not std or np.isnan(std):
        return pd.Series(0.0, index=s.index)
    return ((s - s.mean()) / std).fillna(0.0).clip(-2.5, 2.5)


def _num(v, digits: int = 1):
    """JSON'a yazılabilir sayı; NaN/None -> None."""
    if v is None:
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return None if np.isnan(f) else round(f, digits)


def _latest_season() -> int | None:
    dirs = sorted((config.DATA_DIR / "seasons").glob("*"))
    return int(dirs[-1].name) if dirs else None


def _read_season(season: int, name: str) -> pd.DataFrame | None:
    return transform.read_json(config.DATA_DIR / "seasons" / str(season) / f"{name}.json")


def _read_payload(name: str) -> dict | None:
    path = config.DATA_DIR / f"{name}.json"
    if not path.exists():
        return None
    with open(path) as f:
        return json.load(f)


def _frame(payload: dict | None) -> pd.DataFrame:
    if not payload or "rows" not in payload:
        return pd.DataFrame()
    return pd.DataFrame(payload["rows"], columns=payload["columns"])


_ORD_SUFFIX = {1: "st", 2: "nd", 3: "rd"}


def _ord(n: int) -> str:
    """1 -> 1st, 2 -> 2nd ... (matchup sıralamalarını yazarken)."""
    suffix = "th" if 10 <= n % 100 <= 20 else _ORD_SUFFIX.get(n % 10, "th")
    return f"{n}{suffix}"


# ------------------------------------------------------------------- form

def player_form(pw: pd.DataFrame, snaps: pd.DataFrame | None,
                last_week: int) -> pd.DataFrame:
    """Oyuncu başına sezon/son-3-hafta karşılaştırması.

    Fırsat (opportunity) pozisyona göre farklı sayılır: QB'de pas denemesi,
    RB'de taşıma + hedef, WR/TE'de hedef. Hepsi maç başına.
    """
    reg = pw[(pw["season_type"] == "REG") & pw["position"].isin(SKILL_POS)].copy()
    if reg.empty:
        return pd.DataFrame()

    for c in ("fantasy_points_ppr", "attempts", "carries", "targets",
              "target_share_calc", "carry_share"):
        if c not in reg.columns:
            reg[c] = np.nan
        reg[c] = pd.to_numeric(reg[c], errors="coerce")

    reg["opportunity"] = np.where(
        reg["position"] == "QB", reg["attempts"].fillna(0),
        np.where(reg["position"] == "RB",
                 reg["carries"].fillna(0) + reg["targets"].fillna(0),
                 reg["targets"].fillna(0)))
    reg["share"] = np.where(reg["position"] == "RB",
                            reg["carry_share"], reg["target_share_calc"])

    window = reg[reg["week"] > last_week - FORM_WINDOW]
    agg = reg.groupby("player_id").agg(
        games=("week", "nunique"),
        ppr_avg=("fantasy_points_ppr", "mean"),
        ppr_std=("fantasy_points_ppr", "std"),
        ppr_max=("fantasy_points_ppr", "max"),
        opp_avg=("opportunity", "mean"),
        share_avg=("share", "mean"),
    )
    win = window.groupby("player_id").agg(
        ppr_recent=("fantasy_points_ppr", "mean"),
        opp_recent=("opportunity", "mean"),
        share_recent=("share", "mean"),
    )
    out = agg.join(win, how="left")

    if snaps is not None and not snaps.empty and "offense_pct" in snaps.columns:
        s = snaps[snaps["game_type"] == "REG"].copy()
        s["offense_pct"] = pd.to_numeric(s["offense_pct"], errors="coerce")
        s["week"] = pd.to_numeric(s["week"], errors="coerce")
        sw = s[s["week"] > last_week - FORM_WINDOW]
        out = out.join(s.groupby("player_id")["offense_pct"].mean().rename("snap_avg"))
        out = out.join(sw.groupby("player_id")["offense_pct"].mean().rename("snap_recent"))
    else:
        out["snap_avg"] = np.nan
        out["snap_recent"] = np.nan

    # Son maçlar (kanıt paketinde ham seri olarak gider)
    recent = reg[reg["week"] > last_week - FORM_WINDOW].sort_values("week")
    games = {}
    for pid, g in recent.groupby("player_id"):
        games[pid] = [
            {"week": int(r.week),
             "opponent": None if pd.isna(r.opponent_team) else str(r.opponent_team),
             "ppr": _num(r.fantasy_points_ppr)}
            for r in g.itertuples()
        ]
    out["recent_games"] = out.index.map(lambda pid: games.get(pid, []))

    out["ppr_cv"] = out["ppr_std"] / out["ppr_avg"].replace(0, np.nan)
    out["form_diff"] = out["ppr_recent"] - out["ppr_avg"]
    out["opp_diff"] = out["opp_recent"] - out["opp_avg"]
    out["snap_diff"] = out["snap_recent"] - out["snap_avg"]
    return out


# --------------------------------------------------------------- matchup

def matchup_table(allowed: pd.DataFrame) -> dict:
    """(savunma takımı, pozisyon) -> verilen PPR ve lig sırası (1 = en cömert)."""
    if allowed.empty:
        return {}
    out = {}
    for r in allowed.itertuples():
        rank = getattr(r, "rank", None)
        out[(str(r.team), str(r.position))] = {
            "ppr_allowed": _num(getattr(r, "ppr_allowed", None)),
            "rank": None if rank is None or pd.isna(rank) else int(rank),
        }
    return out


def injury_table(inj: pd.DataFrame) -> dict:
    """Oyuncunun en son sakatlık raporu (varsa)."""
    if inj.empty or "player_id" not in inj.columns:
        return {}
    df = inj.copy()
    for c in ("season", "week"):
        df[c] = pd.to_numeric(df.get(c), errors="coerce")
    df = df.sort_values(["season", "week"]).drop_duplicates("player_id", keep="last")
    out = {}
    for r in df.itertuples():
        status = getattr(r, "report_status", None)
        if not status or str(status) in ("None", "nan"):
            continue
        detail = getattr(r, "report_primary_injury", None)
        out[str(r.player_id)] = {
            "status": str(status),
            "detail": None if not detail or str(detail) in ("None", "nan") else str(detail),
        }
    return out


# -------------------------------------------------------------- adaylar

def build_candidates(proj: pd.DataFrame, form: pd.DataFrame,
                     matchups: dict, injuries: dict) -> pd.DataFrame:
    """Projeksiyon satırlarını sinyallerle zenginleştirir."""
    if proj.empty or form.empty:
        return pd.DataFrame()

    df = proj.copy()
    for c in ("proj_ppr", "proj_floor_ppr", "proj_ceiling_ppr"):
        df[c] = pd.to_numeric(df.get(c), errors="coerce")
    df = df[df["proj_ppr"].notna() & (df["proj_ppr"] >= MIN_PROJ_PPR)]
    df = df[df["position"].isin(SKILL_POS)]
    # Pozisyon içi projeksiyon sırası: yalnızca oynatılabilir derinlik aday olur
    pos_rank = df.groupby("position")["proj_ppr"].rank(ascending=False, method="min")
    df = df[pos_rank <= df["position"].map(STARTABLE_RANK).fillna(0)]
    df = df.merge(form.reset_index(), on="player_id", how="left")
    df = df[df["games"].fillna(0) >= MIN_GAMES]
    if df.empty:
        return df

    # Sakatlık: "Out" listeye hiç girmez, Doubtful/Questionable ceza alır
    df["injury"] = df["player_id"].map(lambda p: injuries.get(str(p)))
    status = df["injury"].map(lambda i: (i or {}).get("status", ""))
    df = df[~status.str.lower().isin(["out", "injured reserve", "ir"])]
    df["injury_pen"] = status.str.lower().map(
        {"doubtful": 1.0, "questionable": 0.5}).fillna(0.0)

    def look(row, key):
        m = matchups.get((str(row["opponent"]), str(row["position"])))
        return (m or {}).get(key)

    df["opp_rank"] = df.apply(lambda r: look(r, "rank"), axis=1)
    df["opp_allowed"] = df.apply(lambda r: look(r, "ppr_allowed"), axis=1)
    # rank 1 = en cömert savunma -> +1, rank 32 = en zoru -> -1
    df["matchup"] = ((16.5 - pd.to_numeric(df["opp_rank"], errors="coerce"))
                     / 15.5).fillna(0.0)

    # Bandın simetrisi: tavan tarafı taban tarafından ne kadar geniş?
    # Oran yerine simetri kullanılıyor çünkü (tavan-proj)/proj küçük
    # projeksiyonlarda mekanik olarak büyük çıkıyor ve liste yedeklerle
    # doluyordu; simetri projeksiyon büyüklüğünden bağımsız.
    df["room"] = df["proj_ceiling_ppr"] - df["proj_ppr"]
    df["risk"] = df["proj_ppr"] - df["proj_floor_ppr"]
    width = (df["room"] + df["risk"]).replace(0, np.nan)
    df["skew"] = ((df["room"] - df["risk"]) / width).fillna(0.0)
    # Projeksiyon son 3 haftanın önünde koşuyorsa geri dönüş (bust) riski
    df["proj_gap"] = ((df["proj_ppr"] - df["ppr_recent"])
                      / df["ppr_recent"].clip(lower=1.0)).fillna(0.0)

    df["boom_score"] = (
        0.30 * _z(df["skew"])
        + 0.22 * df["matchup"]
        + 0.20 * _z(df["form_diff"])
        + 0.15 * _z(df["opp_diff"])
        + 0.08 * _z(df["ppr_cv"])
        + 0.05 * _z(df["snap_diff"])
        - 0.60 * df["injury_pen"]
    )
    df["bust_score"] = (
        -0.28 * _z(df["skew"])
        - 0.22 * df["matchup"]
        - 0.18 * _z(df["form_diff"])
        - 0.15 * _z(df["opp_diff"])
        + 0.17 * _z(df["proj_gap"])
        - 0.05 * _z(df["snap_diff"])
        + 0.60 * df["injury_pen"]
    )
    return df


def _pct(v) -> str:
    return "—" if v is None or pd.isna(v) else f"{round(float(v) * 100)}%"


def _tone(diff, up, down: float | None = None) -> str:
    """Sinyalin yönü: boom'u mu destekliyor (up), bust'ı mı (down)?"""
    if diff is None or pd.isna(diff):
        return "neutral"
    down = -up if down is None else down
    if diff >= up:
        return "up"
    if diff <= down:
        return "down"
    return "neutral"


def _signals(row: pd.Series) -> list[dict]:
    """Ekranda ve kanıt paketinde görünen okunur sinyal satırları (İngilizce).

    `tone` alanı sinyalin hangi yönü desteklediğini söyler: arayüz buna göre
    renklendirir, kural tabanlı metin de yalnızca çağrıyı destekleyen
    sinyalleri cümleye alır.
    """
    band = ""
    if pd.notna(row.get("proj_ceiling_ppr")):
        band = (f" (floor {_num(row['proj_floor_ppr'])} / "
                f"ceiling {_num(row['proj_ceiling_ppr'])})")
        if abs(row.get("skew", 0)) >= 0.15:
            side = "above" if row["skew"] > 0 else "below"
            band += (f" — {_num(max(row['room'], row['risk']))} of the range sits "
                     f"{side} the projection")
    out = [{
        "key": "projection", "label": "Projection",
        "tone": _tone(row.get("skew"), 0.15),
        "value": f"{_num(row['proj_ppr'])} PPR{band}",
    }]

    if pd.notna(row.get("opp_rank")):
        rank = int(row["opp_rank"])
        word = "most generous" if rank <= 16 else "stingiest"
        place = rank if rank <= 16 else 33 - rank
        out.append({
            "key": "matchup", "label": "Matchup",
            "tone": "up" if rank <= 12 else "down" if rank >= 21 else "neutral",
            "value": (f"{row['opponent']} allows {_num(row['opp_allowed'])} PPR/game "
                      f"to {row['position']}s — {_ord(place)} {word} in the league"),
        })

    if pd.notna(row.get("ppr_recent")):
        out.append({
            "key": "form", "label": "Form",
            "tone": _tone(row.get("form_diff"), 1.5),
            "value": (f"{_num(row['ppr_recent'])} PPR/game over the last "
                      f"{FORM_WINDOW} vs {_num(row['ppr_avg'])} season average "
                      f"({_num(row['form_diff']):+})"),
        })

    if pd.notna(row.get("opp_recent")):
        unit = {"QB": "pass attempts", "RB": "touches"}.get(row["position"], "targets")
        line = (f"{_num(row['opp_recent'])} {unit}/game over the last {FORM_WINDOW} "
                f"vs {_num(row['opp_avg'])} season ({_num(row['opp_diff']):+})")
        # QB'de "target share" anlamsız (hep 0) — yalnızca skill pozisyonlarında
        if row["position"] != "QB" and pd.notna(row.get("share_recent")):
            share_name = "carry share" if row["position"] == "RB" else "target share"
            line += (f"; {share_name} {_pct(row['share_recent'])}"
                     f" vs {_pct(row['share_avg'])} season")
        out.append({"key": "usage", "label": "Usage", "value": line,
                    "tone": _tone(row.get("opp_diff"), 1.0)})

    if pd.notna(row.get("snap_recent")) and pd.notna(row.get("snap_diff")):
        out.append({
            "key": "snaps", "label": "Snaps",
            "tone": _tone(row.get("snap_diff"), 0.05),
            "value": (f"{_pct(row['snap_recent'])} snap share over the last "
                      f"{FORM_WINDOW} vs {_pct(row['snap_avg'])} season "
                      f"({round(row['snap_diff'] * 100):+} points)"),
        })

    if pd.notna(row.get("ppr_std")):
        out.append({
            "key": "volatility", "label": "Volatility", "tone": "neutral",
            "value": (f"weekly PPR swings ±{_num(row['ppr_std'])} around a "
                      f"{_num(row['ppr_avg'])} average, best week "
                      f"{_num(row['ppr_max'])}"),
        })

    inj = row.get("injury")
    if isinstance(inj, dict) and inj.get("status"):
        out.append({
            "key": "injury", "label": "Injury", "tone": "down",
            "value": inj["status"] + (f" — {inj['detail']}" if inj.get("detail") else ""),
        })
    return out


def select_picks(cands: pd.DataFrame) -> list[dict]:
    """Her oyuncu tek listeye girer (hangi puanı yüksekse), takım başına limitli."""
    if cands.empty:
        return []
    df = cands.copy()
    df["kind"] = np.where(df["boom_score"] >= df["bust_score"], "boom", "bust")
    # Doubtful bir oyuncu tanımı gereği boom adayı olamaz
    df.loc[df["injury_pen"] >= 1.0, "kind"] = "bust"
    df["score"] = np.where(df["kind"] == "boom", df["boom_score"], df["bust_score"])

    picks = []
    for kind in ("boom", "bust"):
        pool = df[df["kind"] == kind].sort_values("score", ascending=False)
        by_team: dict[str, int] = {}
        by_pos: dict[str, int] = {}
        taken = 0
        for _, row in pool.iterrows():
            if taken >= PICKS_PER_LIST:
                break
            team, pos = str(row["team"]), str(row["position"])
            if by_team.get(team, 0) >= MAX_PER_TEAM or by_pos.get(pos, 0) >= MAX_PER_POS:
                continue
            by_team[team] = by_team.get(team, 0) + 1
            by_pos[pos] = by_pos.get(pos, 0) + 1
            taken += 1
            picks.append({
                "player_id": str(row["player_id"]),
                "player_name": row["player_name"],
                "position": row["position"],
                "team": team,
                "opponent": row["opponent"],
                "kind": kind,
                "score": _num(row["score"], 2),
                "proj_ppr": _num(row["proj_ppr"]),
                "proj_floor_ppr": _num(row["proj_floor_ppr"]),
                "proj_ceiling_ppr": _num(row["proj_ceiling_ppr"]),
                "recent_games": row.get("recent_games") or [],
                "signals": _signals(row),
            })
    return picks


# --------------------------------------------------------------- maç notları

def game_notes(sched: pd.DataFrame, ta: pd.DataFrame | None,
               season: int, week: int) -> list[dict]:
    """Hedef haftanın maçları + iki tarafın EPA sıralaması."""
    if sched.empty:
        return []
    g = sched[(pd.to_numeric(sched["season"], errors="coerce") == season)
              & (pd.to_numeric(sched["week"], errors="coerce") == week)]
    if g.empty:
        return []

    ranks = {}
    if ta is not None and not ta.empty:
        off = pd.to_numeric(ta["off_epa_play"], errors="coerce").rank(
            ascending=False, method="min")
        dfn = pd.to_numeric(ta["def_epa_play"], errors="coerce").rank(
            ascending=True, method="min")
        for team, o, d in zip(ta["team"], off, dfn):
            if not pd.isna(o) and not pd.isna(d):
                ranks[str(team)] = (int(o), int(d))

    out = []
    for row in g.itertuples():
        away, home = str(row.away_team), str(row.home_team)
        note = {"game": f"{away} @ {home}", "away": away, "home": home}
        for side, team in (("away", away), ("home", home)):
            if team in ranks:
                note[f"{side}_off_rank"] = ranks[team][0]
                note[f"{side}_def_rank"] = ranks[team][1]
        total = getattr(row, "total", None)
        if total is not None and not pd.isna(total):
            note["total"] = _num(total)
        out.append(note)
    return out


# ------------------------------------------------------------------ anlatı

SYSTEM = """You are the StatGrade NFL analyst. You write the site's weekly \
boom/bust column.

Rules you must follow exactly:
1. Every number you write must appear verbatim in the evidence you are given. \
Never estimate, round differently, or invent a statistic. If you want to make a \
point you have no number for, make it qualitatively instead.
2. Never mention betting lines, odds, or wagering advice.
3. The evidence is produced by a statistical model, not by you. Your job is to \
explain *why* a signal matters, not to re-rank the players.
4. Write in plain, confident English for a fantasy-football audience. No hedging \
filler ("could potentially maybe"), no emoji, no exclamation marks.
5. A "boom" call means the player is likely to clear his projection by a wide \
margin. A "bust" call means he is likely to fall well short of it. Both are \
about the gap to the projection, not about the player being good or bad."""

USER_TEMPLATE = """Week {week} of the {season} NFL season.

The model has flagged {n_boom} boom candidates and {n_bust} bust candidates. \
For each one, write:
  - angle: a headline of at most 60 characters
  - note: 1-2 sentences (max 320 characters) explaining the call, citing the \
strongest one or two signals by their actual numbers
  - confidence: "high" if the signals agree and are strong, "medium" if mixed, \
"low" if it rests on a single signal

Then write the weekly bulletin:
  - headline: one line capturing the week, at most 80 characters
  - overview: 2-3 sentences framing what the model sees this week
  - sections: 3 or 4 sections, each with a title (max 40 characters) and a body \
of 2-4 sentences. Suggested angles: games the projections like, a usage or \
snap-share trend worth following, a regression watch, an under-the-radar name. \
Use the player evidence and the game list; do not introduce players who are not \
in the evidence.

Return one entry in "picks" for every player_id below, in the same order.

EVIDENCE
{evidence}"""

SCHEMA = {
    "type": "object",
    "properties": {
        "headline": {"type": "string"},
        "overview": {"type": "string"},
        "picks": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "player_id": {"type": "string"},
                    "angle": {"type": "string"},
                    "note": {"type": "string"},
                    "confidence": {"type": "string",
                                   "enum": ["high", "medium", "low"]},
                },
                "required": ["player_id", "angle", "note", "confidence"],
                "additionalProperties": False,
            },
        },
        "sections": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "body": {"type": "string"},
                },
                "required": ["title", "body"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["headline", "overview", "picks", "sections"],
    "additionalProperties": False,
}


def _evidence(picks: list[dict], games: list[dict], record: dict | None) -> str:
    """Modele giden kompakt kanıt paketi (JSON)."""
    packet = {
        "players": [{
            "player_id": p["player_id"],
            "name": p["player_name"],
            "position": p["position"],
            "team": p["team"],
            "opponent": p["opponent"],
            "flagged_as": p["kind"],
            "model_score": p["score"],
            "signals": [s["value"] for s in p["signals"]],
            "last_games": p["recent_games"],
        } for p in picks],
        "games": games,
    }
    if record and record.get("weeks"):
        packet["model_track_record"] = record
    return json.dumps(packet, ensure_ascii=False, indent=1)


def narrate(picks: list[dict], games: list[dict], record: dict | None,
            season: int, week: int) -> dict | None:
    """Claude'a kanıt paketini gönderip anlatıyı alır. Hata olursa None."""
    if not os.environ.get("ANTHROPIC_API_KEY"):
        log.warning("ANTHROPIC_API_KEY yok — anlatı kural tabanlı üretilecek")
        return None
    try:
        import anthropic
    except ImportError:
        log.warning("anthropic paketi kurulu değil — anlatı kural tabanlı üretilecek")
        return None

    prompt = USER_TEMPLATE.format(
        season=season, week=week,
        n_boom=sum(1 for p in picks if p["kind"] == "boom"),
        n_bust=sum(1 for p in picks if p["kind"] == "bust"),
        evidence=_evidence(picks, games, record))

    # Akış kullanılıyor: adaptive thinking + 16 gerekçe uzun sürebiliyor,
    # tek parça istek zaman aşımına düşebilir.
    client = anthropic.Anthropic()
    with client.messages.stream(
        model=MODEL,
        max_tokens=MAX_TOKENS,
        system=[{"type": "text", "text": SYSTEM,
                 "cache_control": {"type": "ephemeral"}}],
        messages=[{"role": "user", "content": prompt}],
        thinking={"type": "adaptive"},
        output_config={"effort": "high",
                       "format": {"type": "json_schema", "schema": SCHEMA}},
    ) as stream:
        response = stream.get_final_message()

    if response.stop_reason == "refusal":
        log.warning("Model yanıtı reddetti: %s", response.stop_details)
        return None
    if response.stop_reason == "max_tokens":
        log.warning("Yanıt max_tokens'a takıldı, anlatı atlanıyor")
        return None

    text = next((b.text for b in response.content if b.type == "text"), None)
    if not text:
        log.warning("Model metin bloğu döndürmedi")
        return None
    usage = response.usage
    log.info("Claude anlatısı alındı (in=%s, out=%s token)",
             usage.input_tokens, usage.output_tokens)
    return json.loads(text)


def _fallback_note(pick: dict) -> tuple[str, str, str]:
    """API yokken kural tabanlı metin.

    Yalnızca çağrının yönünü *destekleyen* sinyaller cümleye girer; aksi
    halde "boom adayı, çünkü rakip savunma lig birincisi" gibi kendini
    çürüten cümleler çıkıyordu.
    """
    want = "up" if pick["kind"] == "boom" else "down"
    order = ["injury", "matchup", "form", "usage", "snaps", "projection"]
    ranked = sorted((s for s in pick["signals"] if s.get("tone") == want),
                    key=lambda s: order.index(s["key"]) if s["key"] in order else 99)
    used = [s["value"] for s in ranked[:2]]
    verb = ("has the setup to clear" if pick["kind"] == "boom"
            else "is at risk of falling short of")
    angle = (f"Upside play vs {pick['opponent']}" if pick["kind"] == "boom"
             else f"Fade risk vs {pick['opponent']}")
    note = f"{pick['player_name']} {verb} a {pick['proj_ppr']} PPR projection"
    note += (": " + "; ".join(used) + "." if used
             else " based on the model's projection range.")
    return angle, note, "medium" if len(used) > 1 else "low"


def apply_narrative(picks: list[dict], narrative: dict | None) -> None:
    """Model metnini seçimlere yazar; eksik kalanı kural tabanlı doldurur."""
    written = {}
    for item in (narrative or {}).get("picks", []):
        pid = str(item.get("player_id", ""))
        if pid:
            written[pid] = item
    for p in picks:
        item = written.get(p["player_id"])
        if item and item.get("note"):
            p["angle"] = item.get("angle") or ""
            p["note"] = item["note"]
            p["confidence"] = item.get("confidence") or "medium"
            p["written_by"] = "model"
        else:
            p["angle"], p["note"], p["confidence"] = _fallback_note(p)
            p["written_by"] = "rules"


# -------------------------------------------------------------------- karne

def grade(previous: dict | None, pw_by_season: dict) -> tuple[list[dict], dict]:
    """Önceki çağrıları gerçek sonuçlarla kıyaslar (bkz. BOOM_RATIO/BUST_RATIO)."""
    if not previous:
        return [], {}

    # Hafta başına tek kayıt; aynı hafta yeniden üretildiyse (maç günü koşusu)
    # en son çağrılar geçerlidir.
    by_week: dict[tuple, dict] = {}
    for entry in previous.get("history") or []:
        if entry.get("week") is not None:
            by_week[(entry.get("season"), entry["week"])] = entry
    target = previous.get("target") or {}
    if previous.get("picks") and target.get("week"):
        by_week[(target.get("season"), target["week"])] = {
            "season": target.get("season"),
            "week": target["week"],
            "picks": [{k: p[k] for k in
                       ("player_id", "player_name", "position", "team", "opponent",
                        "kind", "proj_ppr", "proj_floor_ppr", "proj_ceiling_ppr",
                        "angle", "note")
                       if k in p}
                      for p in previous["picks"]],
        }

    graded = []
    for entry in by_week.values():
        pw = pw_by_season.get(entry.get("season"))
        if pw is not None:
            actual = pw[(pd.to_numeric(pw["week"], errors="coerce") == entry["week"])
                        & (pw["season_type"] == "REG")]
            got = dict(zip(actual["player_id"].astype(str),
                           pd.to_numeric(actual["fantasy_points_ppr"],
                                         errors="coerce")))
            for p in entry["picks"]:
                a = got.get(str(p["player_id"]))
                if a is None or pd.isna(a):
                    continue
                p["actual_ppr"] = _num(a)
                proj = p.get("proj_ppr") or 0
                if p["kind"] == "boom":
                    bar = proj * BOOM_RATIO
                    p["hit"] = bool(a >= bar)
                else:
                    bar = proj * BUST_RATIO
                    p["hit"] = bool(a <= bar)
                p["bar"] = _num(bar)
        graded.append(entry)

    graded.sort(key=lambda e: (e.get("season") or 0, e.get("week") or 0))
    graded = graded[-HISTORY_WEEKS:]

    record = {"weeks": 0, "boom": {"hits": 0, "n": 0}, "bust": {"hits": 0, "n": 0}}
    for entry in graded:
        scored = [p for p in entry["picks"] if "hit" in p]
        if not scored:
            continue
        record["weeks"] += 1
        for p in scored:
            side = record[p["kind"]]
            side["n"] += 1
            side["hits"] += int(p["hit"])
    for side in ("boom", "bust"):
        n = record[side]["n"]
        record[side]["rate"] = round(record[side]["hits"] / n, 3) if n else None
    return graded, record


# ------------------------------------------------------------------- giriş

def build_and_write() -> None:
    season = _latest_season()
    proj_payload = _read_payload("projections")
    if season is None or not proj_payload:
        log.warning("Agent için veri yok (sezon ya da projeksiyon eksik)")
        return

    target = proj_payload.get("target") or {}
    tgt_season = int(target.get("season") or season)
    tgt_week = int(target.get("week") or 0)

    pw = _read_season(season, "player_weeks")
    if pw is None or pw.empty:
        log.warning("Agent için haftalık veri yok")
        return
    reg = pw[pw["season_type"] == "REG"]
    last_week = int(pd.to_numeric(reg["week"], errors="coerce").max())

    form = player_form(pw, _read_season(season, "snap_counts"), last_week)
    cands = build_candidates(
        _frame(proj_payload), form,
        matchup_table(_frame(_read_payload("pos_allowed"))),
        injury_table(_frame(_read_payload("injuries"))))
    picks = select_picks(cands)
    if not picks:
        log.warning("Agent aday bulamadı, agent.json yazılmadı")
        return

    games = game_notes(_frame(_read_payload("next_schedule")),
                       _read_season(season, "team_advanced"), tgt_season, tgt_week)

    # Karne: bir önceki agent.json'daki çağrılar artık oynanmışsa notlanır
    pw_by_season = {season: pw}
    if tgt_season != season:
        prev_pw = _read_season(tgt_season, "player_weeks")
        if prev_pw is not None:
            pw_by_season[tgt_season] = prev_pw
    history, record = grade(_read_payload("agent"), pw_by_season)

    narrative = None
    try:
        narrative = narrate(picks, games, record, tgt_season, tgt_week)
    except Exception:
        log.exception("Claude anlatısı alınamadı, kural tabanlı metne dönülüyor")
    apply_narrative(picks, narrative)

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "data_season": season,
        "through_week": last_week,
        "target": {"season": tgt_season, "week": tgt_week},
        "engine": MODEL if narrative else "rules",
        "language": "en",
        "headline": (narrative or {}).get("headline") or
                    f"Week {tgt_week} boom and bust candidates",
        "overview": (narrative or {}).get("overview") or
                    ("Signals below are computed from projection bands, recent form, "
                     "usage trends and position matchups."),
        "sections": (narrative or {}).get("sections") or [],
        "picks": picks,
        "record": record,
        "history": history,
    }
    path = config.DATA_DIR / "agent.json"
    with open(path, "w") as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"),
                  allow_nan=False)
    log.info("Agent yazıldı: %s çağrı (%s W%s, motor=%s)",
             len(picks), tgt_season, tgt_week, payload["engine"])
