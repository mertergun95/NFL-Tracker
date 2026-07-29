"""Pipeline tarafı çeviriler.

Insights metinleri üç dilde birden üretilir; JSON'a
{"en": "...", "tr": "...", "de": "..."} sözlüğü olarak yazılır ve arayüz
seçili dile göre gösterir. `tr()` yardımcısı bir şablon anahtarını
parametrelerle doldurup bu sözlüğü döndürür.
"""
from __future__ import annotations

LANGS = ("en", "tr", "de")

# Şablonlar: {param} yer tutucuları tr(...) çağrısındaki anahtarlarla dolar.
MSG: dict[str, dict[str, str]] = {
    # ---------------------------------------------------------------- form
    "form.title": {
        "en": "{emoji} {name} ({pos}, {team})",
        "tr": "{emoji} {name} ({pos}, {team})",
        "de": "{emoji} {name} ({pos}, {team})",
    },
    "form.detail": {
        "en": "{recent} PPR/game over the last {n} weeks — season average "
              "{avg} ({diff}).",
        "tr": "Son {n} haftada {recent} PPR/maç — sezon ortalaması "
              "{avg} ({diff}).",
        "de": "{recent} PPR/Spiel in den letzten {n} Wochen — Saisonschnitt "
              "{avg} ({diff}).",
    },
    "form.compare": {
        "en": " Last {n} vs season: {parts}.",
        "tr": " Son {n} vs sezon: {parts}.",
        "de": " Letzte {n} vs. Saison: {parts}.",
    },
    # --------------------------------------------------------------- usage
    "usage.detail": {
        "en": "{label} {recent} over the last {n} weeks — season average "
              "{avg} ({diff} points).",
        "tr": "Son {n} haftada {label} {recent} — sezon ortalaması "
              "{avg} ({diff} puan).",
        "de": "{label} {recent} in den letzten {n} Wochen — Saisonschnitt "
              "{avg} ({diff} Punkte).",
    },
    "usage.targetShare": {"en": "target share", "tr": "hedef payı",
                          "de": "Target-Anteil"},
    "usage.carryShare": {"en": "carry share", "tr": "koşu payı",
                         "de": "Lauf-Anteil"},
    # ------------------------------------------------------------ matchup
    "match.edgeTitle": {
        "en": "⚔️ {game}: {off} has the {kind} edge",
        "tr": "⚔️ {game}: {off} {kind} hücumu avantajlı",
        "de": "⚔️ {game}: {off} im Vorteil beim {kind}",
    },
    "match.edgeDetail": {
        "en": "{off}'s {kind} offense ranks #{o} in EPA, {deff}'s {kind} "
              "defense #{d} ({season} data). Breakout potential.",
        "tr": "{off} {kind} hücumu EPA'da lig #{o}, {deff} {kind} savunması "
              "#{d} ({season} verisi). Patlama potansiyeli.",
        "de": "{off}s {kind}-Offense ist #{o} in EPA, {deff}s {kind}-Defense "
              "#{d} ({season}-Daten). Ausbruchspotenzial.",
    },
    "match.kindPass": {"en": "passing", "tr": "pas", "de": "Passspiel"},
    "match.kindRush": {"en": "rushing", "tr": "koşu", "de": "Laufspiel"},
    "match.generousTitle": {
        "en": "🎯 {game}: {deff} is generous to {pos}s",
        "tr": "🎯 {game}: {deff}, {pos} pozisyonuna cömert",
        "de": "🎯 {game}: {deff} ist großzügig gegen {pos}s",
    },
    "match.generousDetail": {
        "en": "The {deff} defense allowed {stats} per game to {pos}s "
              "(league #{rank}, {season}).",
        "tr": "{deff} savunması {pos}'lara maç başına {stats} verdi "
              "(lig #{rank}, {season}).",
        "de": "Die {deff}-Defense ließ {pos}s pro Spiel {stats} zu "
              "(Liga #{rank}, {season}).",
    },
    "match.watch": {
        "en": " Watch: {players}.", "tr": " Takip et: {players}.",
        "de": " Im Blick: {players}.",
    },
    # ------------------------------------------------------------- scheme
    "scheme.blitzGoodTitle": {
        "en": "🧠 {name} is productive against the blitz",
        "tr": "🧠 {name} blitze karşı üretken",
        "de": "🧠 {name} ist stark gegen den Blitz",
    },
    "scheme.blitzGoodDetail": {
        "en": "{epa} EPA/play on {plays} dropbacks against the blitz "
              "({season}). An edge against blitz-heavy defenses.",
        "tr": "Blitze karşı {plays} dropback'te EPA/play {epa} ({season}). "
              "Blitz-ağır savunmalara karşı avantaj.",
        "de": "{epa} EPA/Play bei {plays} Dropbacks gegen den Blitz "
              "({season}). Vorteil gegen blitzlastige Defenses.",
    },
    "scheme.blitzBadTitle": {
        "en": "⚠️ {name} struggles against the blitz",
        "tr": "⚠️ {name} blitze karşı zorlanıyor",
        "de": "⚠️ {name} tut sich schwer gegen den Blitz",
    },
    "scheme.blitzBadDetail": {
        "en": "{epa} EPA/play on {plays} dropbacks against the blitz ({season}).",
        "tr": "Blitze karşı {plays} dropback'te EPA/play {epa} ({season}).",
        "de": "{epa} EPA/Play bei {plays} Dropbacks gegen den Blitz ({season}).",
    },
    "scheme.coverageTitle": {
        "en": "{emoji} {game}: {deff} plays {rate} {cov}",
        "tr": "{emoji} {game}: {deff} {rate} {cov} oynuyor",
        "de": "{emoji} {game}: {deff} spielt zu {rate} {cov}",
    },
    "scheme.coverageDetail": {
        "en": "{deff} allows {epa} EPA/play in this coverage ({verdict}, {season}).",
        "tr": "{deff} bu coverage'da EPA/play {epa} ({verdict}, {season}).",
        "de": "{deff} lässt in dieser Coverage {epa} EPA/Play zu ({verdict}, {season}).",
    },
    "scheme.covMan": {"en": "man coverage", "tr": "man (adam adama)",
                      "de": "Manndeckung"},
    "scheme.covZone": {"en": "zone coverage", "tr": "zone (alan)",
                       "de": "Raumdeckung"},
    "scheme.covWeak": {
        "en": "giving up more than the league average",
        "tr": "lig ortalamasının üstünde yol veriyor",
        "de": "gibt mehr ab als der Liga-Durchschnitt",
    },
    "scheme.covStrong": {
        "en": "one of the stingiest in the league",
        "tr": "ligin en sıkılarından",
        "de": "eine der besten der Liga",
    },
    "scheme.watchOff": {
        "en": " Watch on the {off} side: {players}.",
        "tr": " {off} tarafında izle: {players}.",
        "de": " Auf {off}-Seite beachten: {players}.",
    },
    "scheme.blitzHeavyTitle": {
        "en": "{emoji} {game}: {deff} is blitz-heavy ({rate})",
        "tr": "{emoji} {game}: {deff} blitz-ağır ({rate})",
        "de": "{emoji} {game}: {deff} blitzt viel ({rate})",
    },
    "scheme.blitzHeavyDetail": {
        "en": "{name} posts {epa} EPA/play against the blitz ({season}) — this "
              "matchup is {verdict} him.",
        "tr": "{name} blitze karşı EPA/play {epa} ({season}) — bu eşleşme "
              "{verdict}.",
        "de": "{name} erzielt {epa} EPA/Play gegen den Blitz ({season}) — "
              "dieses Matchup ist {verdict}.",
    },
    "scheme.inFavor": {"en": "in favour of", "tr": "lehine", "de": "zu seinen Gunsten"},
    "scheme.against": {"en": "against", "tr": "aleyhine", "de": "zu seinen Ungunsten"},
    # --------------------------------------------------------- takım gücü
    "power.title": {
        "en": "{emoji} {team} — {metric} #{rank} in the league",
        "tr": "{emoji} {team} — {metric} lig #{rank}",
        "de": "{emoji} {team} — {metric} #{rank} der Liga",
    },
    "power.detail": {"en": "{metric}: {value}", "tr": "{metric}: {value}",
                     "de": "{metric}: {value}"},
    "power.offEpa": {"en": "Offense EPA/play", "tr": "Hücum EPA/play",
                     "de": "Offense EPA/Play"},
    "power.defEpa": {"en": "Defense EPA/play (allowed)",
                     "tr": "Savunma EPA/play (verilen)",
                     "de": "Defense EPA/Play (zugelassen)"},
    # ------------------------------------------- kompakt stat kısaltmaları
    "stat.passYd": {"en": "pass yd", "tr": "pas yd", "de": "Pass-Yds"},
    "stat.passTd": {"en": "pass TD", "tr": "pas TD", "de": "Pass-TD"},
    "stat.int": {"en": "int", "tr": "int", "de": "INT"},
    "stat.rushYd": {"en": "rush yd", "tr": "koşu yd", "de": "Rush-Yds"},
    "stat.rushTd": {"en": "rush TD", "tr": "koşu TD", "de": "Rush-TD"},
    "stat.rec": {"en": "rec", "tr": "rec", "de": "Rec"},
    "stat.recYd": {"en": "rec yd", "tr": "rec yd", "de": "Rec-Yds"},
    "stat.recTd": {"en": "rec TD", "tr": "rec TD", "de": "Rec-TD"},
    # ------------------------------------------------------------- karne
    "eval.method": {
        "en": "each week was projected using only the data available before it "
              "and compared with the actual results (current-roster and injury "
              "adjustments are disabled in the backtest).",
        "tr": "Her hafta yalnızca öncesindeki haftaların verisiyle projekte "
              "edilip gerçek sonuçlarla karşılaştırıldı (güncel kadro ve "
              "sakatlık düzeltmeleri geriye dönük testte kapalı).",
        "de": "Jede Woche wurde nur mit den davor verfügbaren Daten prognostiziert "
              "und mit den echten Ergebnissen verglichen (Kader- und "
              "Verletzungskorrekturen sind im Backtest deaktiviert).",
    },
}


def tr(key: str, **params) -> dict[str, str]:
    """Şablonu üç dilde doldur. Parametre değeri kendisi çok dilliyse
    (dict) o dilin karşılığı kullanılır."""
    tpl = MSG.get(key)
    if tpl is None:
        return {lang: key for lang in LANGS}
    out = {}
    for lang in LANGS:
        local = {k: (v[lang] if isinstance(v, dict) else v)
                 for k, v in params.items()}
        out[lang] = tpl.get(lang, tpl["en"]).format(**local)
    return out


def pct(value: float, digits: int = 0) -> dict[str, str]:
    """Yüzdeyi dile göre biçimler: TR '%60', EN '60%', DE '60 %'."""
    v = f"{value:.{digits}f}"
    return {"en": f"{v}%", "tr": f"%{v}", "de": f"{v} %"}


def join(parts: list[dict[str, str]], sep: str = ", ") -> dict[str, str]:
    """Çok dilli parçaları dil dil birleştirir."""
    return {lang: sep.join(p[lang] for p in parts) for lang in LANGS}


def concat(*chunks: dict[str, str] | str) -> dict[str, str]:
    """Çok dilli (veya düz) metin parçalarını dil dil uç uca ekler."""
    out = {}
    for lang in LANGS:
        out[lang] = "".join(
            c[lang] if isinstance(c, dict) else c for c in chunks)
    return out
