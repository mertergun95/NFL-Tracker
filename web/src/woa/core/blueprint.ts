/** WoA adım şablonu: neye, hangi sırayla, hangi kaynaktan bakılacağı.
 *
 *  Şartname: docs/WOA.md. Buradaki metinler [en, tr, de] üçlüsüdür; arayüz
 *  sözlüğüne (lib/locales.ts) taşınmadılar, çünkü şablonun kendisi bir içerik
 *  kararı — adım eklenip çıkarıldığında tek dosya değişsin.
 */
import { getLang, LANGS } from "../../lib/i18n";

export type L = string | [string, string, string];

/** [en, tr, de] üçlüsünü seçili dile çözer. */
export function tx(v: L): string {
  if (typeof v === "string") return v;
  return v[LANGS.indexOf(getLang())] ?? v[0];
}

/* ------------------------------------------------------------- kaynaklar */

export type Provider = "pff" | "hashtag" | "fbg";
/** Erişim seviyesi — rozet olarak basılır, kullanıcı neyin parayla geldiğini görsün. */
export type Tier = "premium" | "plus" | "free";

export interface ToolDef {
  provider: Provider;
  name: string;
  url: string;
  tier: Tier;
  /** Aracın kendine has uyarısı (ör. haftalık güncelleme günü). */
  warn?: L;
}

export const PROVIDER_NAMES: Record<Provider, string> = {
  pff: "PFF",
  hashtag: "Hashtag",
  fbg: "FootballGuys",
};

/** Araç kataloğu. Kapsam dışı bırakılanlar (draft, dynasty, ADP, waiver,
 *  trade) bilerek yok: sezon öncesi ve lig yönetimi araçları. */
export const TOOLS: Record<string, ToolDef> = {
  "pff.greenline": {
    provider: "pff", tier: "premium", name: "Greenline",
    url: "https://www.pff.com/greenline",
  },
  "pff.keyInsights": {
    provider: "pff", tier: "premium", name: "Key Insights",
    url: "https://www.pff.com/betting/key-insights",
  },
  "pff.bestGameBets": {
    provider: "pff", tier: "premium", name: "Best Game Bets",
    url: "https://www.pff.com/betting/best-game-bets",
  },
  "pff.playerProps": {
    provider: "pff", tier: "plus", name: "Player Props",
    url: "https://www.pff.com/betting/player-props",
  },
  "pff.firstTd": {
    provider: "pff", tier: "plus", name: "First TD Finder",
    url: "https://www.pff.com/betting/first-touchdown",
  },
  "pff.powerRankings": {
    provider: "pff", tier: "premium", name: "NFL Power Rankings",
    url: "https://www.pff.com/betting/nfl-power-rankings",
  },
  "pff.premiumStats": {
    provider: "pff", tier: "premium", name: "Premium Stats",
    url: "https://premium.pff.com/nfl/teams",
  },
  "pff.wrCb": {
    provider: "pff", tier: "premium", name: "WR/CB Matchup Chart",
    url: "https://www.pff.com/tools/wr_cb_matchup_chart",
    warn: ["Updated on Thursdays — before that you may be reading last week's chart.",
           "Perşembe günleri güncellenir — öncesinde geçen haftanın tablosunu okuyor olabilirsin.",
           "Wird donnerstags aktualisiert — davor siehst du evtl. die Vorwoche."],
  },
  "pff.matchups": {
    provider: "pff", tier: "premium", name: "Matchups",
    url: "https://www.pff.com/tools/matchups",
  },
  "pff.fantasyStats": {
    provider: "pff", tier: "premium", name: "Fantasy Stats / Red Zone",
    url: "https://www.pff.com/fantasy/stats",
  },
  "pff.fantasyProjections": {
    provider: "pff", tier: "premium", name: "Fantasy Projections",
    url: "https://www.pff.com/fantasy/projections",
  },
  "hashtag.targetShares": {
    provider: "hashtag", tier: "plus", name: "Target Shares",
    url: "https://hashtagfootball.com/nfl-target-shares",
  },
  "hashtag.snapShares": {
    provider: "hashtag", tier: "plus", name: "Snap Shares",
    url: "https://hashtagfootball.com/nfl-snap-shares",
  },
  "hashtag.carries": {
    provider: "hashtag", tier: "plus", name: "Carries",
    url: "https://hashtagfootball.com/nfl-carries",
  },
  "hashtag.receptionRate": {
    provider: "hashtag", tier: "plus", name: "Reception Rate",
    url: "https://hashtagfootball.com/nfl-reception-rate",
  },
  "hashtag.cbCoverage": {
    provider: "hashtag", tier: "plus", name: "CB Coverage",
    url: "https://hashtagfootball.com/nfl-cornerback-coverage",
  },
  "hashtag.qbEfficiency": {
    provider: "hashtag", tier: "plus", name: "QB Efficiency",
    url: "https://hashtagfootball.com/nfl-qb-efficiency",
  },
  "hashtag.rbElusiveness": {
    provider: "hashtag", tier: "plus", name: "RB Elusiveness",
    url: "https://hashtagfootball.com/nfl-rb-elusiveness",
  },
  "hashtag.rbWorkload": {
    provider: "hashtag", tier: "plus", name: "RB Workload",
    url: "https://hashtagfootball.com/nfl-rb-workload",
  },
  "hashtag.slotProduction": {
    provider: "hashtag", tier: "plus", name: "Slot Production",
    url: "https://hashtagfootball.com/nfl-slot-production",
  },
  "hashtag.consistency": {
    provider: "hashtag", tier: "plus", name: "Consistency",
    url: "https://hashtagfootball.com/fantasy-football-consistency",
  },
  "hashtag.injury": {
    provider: "hashtag", tier: "free", name: "Injury Database",
    url: "https://hashtagfootball.com/nfl-injury",
  },
  "hashtag.projections": {
    provider: "hashtag", tier: "plus", name: "Projections",
    url: "https://hashtagfootball.com/fantasy-football-projections",
  },
  "fbg.weekly": {
    provider: "fbg", tier: "free", name: "Weekly preview / start-sit",
    url: "https://www.footballguys.com/",
  },
};

/* ----------------------------------------------------------- alan tanımı */

export interface FieldOption { value: string; label: L }

export interface FieldDef {
  key: string;
  label: L;
  /** "team" iki kutu çizer (deplasman + ev), "single" tek kutu. */
  scope: "team" | "single";
  input: "number" | "text" | "select" | "rating";
  options?: FieldOption[];
  suffix?: string;
}

export interface SourceRef {
  /** Katalog anahtarı; kapsama sayacı bunun üzerinden tekilleştirir. */
  tool: string;
  /** Dış kaynaktan dönerken ne getireceksin. */
  bring: L;
  fields?: FieldDef[];
  /** Yalnız bu pozisyonlarda göster (oyuncu adımları). */
  pos?: string[];
}

export interface StepDef {
  id: string;
  phase: "game" | "player";
  block: L;
  title: L;
  why: L;
  /** Kilit adım: tamamlanmadan oyuncu analizi (maç fazı) ya da karar (oyuncu
   *  fazı) açılmaz. */
  required: boolean;
  notes: "perTeam" | "single";
  fields?: FieldDef[];
  sources: SourceRef[];
}

const BLOCK_CONTEXT: L = ["Context", "Bağlam", "Kontext"];
const BLOCK_EDGE: L = ["Efficiency & matchup", "Verimlilik & eşleşme",
                       "Effizienz & Matchup"];
const BLOCK_CALL: L = ["Call", "Karar", "Entscheidung"];
const BLOCK_ROLE: L = ["Role", "Rol", "Rolle"];
const BLOCK_EDGE_P: L = ["Edge", "Avantaj", "Vorteil"];

const LEAN_SIDE: FieldOption[] = [
  { value: "away", label: ["Away", "Deplasman", "Auswärts"] },
  { value: "home", label: ["Home", "Ev", "Heim"] },
  { value: "pass", label: ["No bet", "Pas", "Kein Wett"] },
];
const LEAN_TOTAL: FieldOption[] = [
  { value: "over", label: "Over" },
  { value: "under", label: "Under" },
  { value: "pass", label: ["No bet", "Pas", "Kein Wett"] },
];
const LEAN_PROP: FieldOption[] = [
  { value: "over", label: "Over" },
  { value: "under", label: "Under" },
  { value: "pass", label: ["No bet", "Pas", "Kein Wett"] },
];

const CONFIDENCE: FieldDef = {
  key: "confidence", scope: "single", input: "rating",
  label: ["Confidence", "Güven", "Sicherheit"],
};

export const GAME_STEPS: StepDef[] = [
  {
    id: "M1", phase: "game", block: BLOCK_CONTEXT, required: true, notes: "perTeam",
    title: ["Line & context", "Künye & çizgi", "Linie & Kontext"],
    why: ["What is the market pricing in, and what do the conditions change?",
          "Piyasa neyi fiyatlıyor, koşullar neyi değiştiriyor?",
          "Was preist der Markt ein, und was ändern die Bedingungen?"],
    fields: [
      { key: "spread", scope: "single", input: "number",
        label: ["Home spread", "Ev sahibi çizgisi", "Heim-Spread"] },
      { key: "total", scope: "single", input: "number",
        label: ["Total", "Toplam", "Total"] },
    ],
    sources: [
      { tool: "pff.greenline",
        bring: ["Greenline's projected spread and total",
                "Greenline'ın spread ve total tahmini",
                "Greenlines projizierter Spread und Total"],
        fields: [
          { key: "spread", scope: "single", input: "number",
            label: ["Greenline spread", "Greenline spread", "Greenline-Spread"] },
          { key: "total", scope: "single", input: "number",
            label: ["Greenline total", "Greenline total", "Greenline-Total"] },
        ] },
      { tool: "pff.keyInsights",
        bring: ["The one statistical angle PFF flags for this game",
                "PFF'in bu maç için öne çıkardığı istatistik açısı",
                "Der statistische Aspekt, den PFF für dieses Spiel hervorhebt"] },
      { tool: "fbg.weekly",
        bring: ["The free weekly preview's take on the game",
                "Ücretsiz haftalık önizlemenin maça bakışı",
                "Die Einschätzung der kostenlosen Wochenvorschau"] },
    ],
  },
  {
    id: "M2", phase: "game", block: BLOCK_CONTEXT, required: true, notes: "perTeam",
    title: ["Health & personnel", "Sağlık & kadro", "Verfügbarkeit & Kader"],
    why: ["Who is out, who replaces them, and has the line priced it in?",
          "Kim yok, yerine kim geçiyor, çizgi bunu fiyatlamış mı?",
          "Wer fehlt, wer ersetzt ihn, und ist das eingepreist?"],
    sources: [
      { tool: "pff.premiumStats",
        bring: ["Grade of the missing starter and of his replacement",
                "Eksik oyuncunun ve yerine geçenin grade'i",
                "Note des fehlenden Starters und seines Ersatzes"],
        fields: [{ key: "swing", scope: "team", input: "text",
                   label: ["Out → in (grade)", "Eksik → yerine (grade)",
                           "Fehlt → Ersatz (Note)"] }] },
      { tool: "hashtag.injury",
        bring: ["Cross-check our injury table against theirs",
                "Bizim sakatlık tablomuzu onlarınkiyle karşılaştır",
                "Unsere Verletzungstabelle gegenprüfen"] },
    ],
  },
  {
    id: "M3", phase: "game", block: BLOCK_CONTEXT, required: false, notes: "perTeam",
    title: ["Form & strength", "Form & güç", "Form & Stärke"],
    why: ["Who is actually good, and who is being flattered by results?",
          "Kim gerçekten iyi, kimi sonuçlar şişiriyor?",
          "Wer ist wirklich gut, wen schmeicheln die Ergebnisse?"],
    sources: [
      { tool: "pff.powerRankings",
        bring: ["PFF's rank for each team — compare with ours",
                "PFF'in her takım için sırası — bizimkiyle karşılaştır",
                "PFFs Rang je Team — mit unserem vergleichen"],
        fields: [{ key: "rank", scope: "team", input: "number",
                   label: ["PFF rank", "PFF sırası", "PFF-Rang"] }] },
      { tool: "hashtag.consistency",
        bring: ["Are the key producers steady or boom/bust?",
                "Kilit üreticiler istikrarlı mı, boom/bust mı?",
                "Sind die Leistungsträger konstant oder schwankend?"] },
    ],
  },
  {
    id: "M4", phase: "game", block: BLOCK_EDGE, required: true, notes: "perTeam",
    title: ["Efficiency cross-matchup", "Verimlilik çaprazı", "Effizienz-Kreuzvergleich"],
    why: ["Each offense against the defense it actually faces — where is the edge?",
          "Her hücum, karşısına çıkacak savunmaya karşı — avantaj nerede?",
          "Jede Offense gegen die Defense, der sie begegnet — wo liegt der Vorteil?"],
    sources: [
      { tool: "pff.premiumStats",
        bring: ["Team offense and defense grades (0–100)",
                "Takım hücum ve savunma grade'leri (0–100)",
                "Team-Noten für Offense und Defense (0–100)"],
        fields: [
          { key: "off", scope: "team", input: "number",
            label: ["Offense grade", "Hücum grade", "Offense-Note"] },
          { key: "def", scope: "team", input: "number",
            label: ["Defense grade", "Savunma grade", "Defense-Note"] },
        ] },
    ],
  },
  {
    id: "M5", phase: "game", block: BLOCK_EDGE, required: false, notes: "perTeam",
    title: ["Pace & pass tendency", "Tempo & pas eğilimi", "Tempo & Passneigung"],
    why: ["How many plays does this game get, and what does that do to the total?",
          "Bu maç kaç oyun görür, bu total'e ne yapar?",
          "Wie viele Spielzüge gibt es, und was macht das mit dem Total?"],
    fields: [{ key: "plays", scope: "single", input: "number",
               label: ["Expected plays (both teams)", "Beklenen oyun sayısı (iki takım)",
                       "Erwartete Spielzüge (beide Teams)"] }],
    sources: [
      { tool: "hashtag.snapShares",
        bring: ["Offensive snap trend — is the unit running more or fewer plays?",
                "Hücum snap trendi — birim daha çok mu az mı oyun oynuyor?",
                "Snap-Trend der Offense — mehr oder weniger Spielzüge?"] },
    ],
  },
  {
    id: "M6", phase: "game", block: BLOCK_EDGE, required: false, notes: "perTeam",
    title: ["Scheme matchup", "Şema eşleşmesi", "Scheme-Matchup"],
    why: ["Does the defense's tendency land on the offense's weak spot?",
          "Savunmanın eğilimi hücumun zayıf yönüne mi denk geliyor?",
          "Trifft die Tendenz der Defense die Schwäche der Offense?"],
    sources: [
      { tool: "pff.premiumStats",
        bring: ["Coverage grade for each secondary",
                "Her savunma dörtlüsünün coverage grade'i",
                "Coverage-Note der Secondary"],
        fields: [{ key: "cov", scope: "team", input: "number",
                   label: ["Coverage grade", "Coverage grade", "Coverage-Note"] }] },
      { tool: "hashtag.cbCoverage",
        bring: ["Man/zone quality per cornerback — we have no player-level man/zone split",
                "Cornerback bazında man/zone kalitesi — oyuncu bazlı man/zone bizde yok",
                "Man/Zone-Qualität je Cornerback — fehlt in unseren Daten"],
        fields: [{ key: "cb", scope: "team", input: "text",
                   label: ["Best CB / weak link", "En iyi CB / zayıf halka",
                           "Bester CB / Schwachstelle"] }] },
    ],
  },
  {
    id: "M7", phase: "game", block: BLOCK_EDGE, required: false, notes: "perTeam",
    title: ["Trenches", "Hat savaşı", "Line-Duell"],
    why: ["Pressure decides more games than any skill-position edge.",
          "Baskı, hiçbir skill pozisyonu avantajının belirlemediği kadar maç belirler.",
          "Druck entscheidet mehr Spiele als jeder Skill-Position-Vorteil."],
    sources: [
      { tool: "pff.premiumStats",
        bring: ["Pass-block grade of the line, pass-rush grade of the front",
                "Hattın pass-block, savunma hattının pass-rush grade'i",
                "Pass-Block-Note der Line, Pass-Rush-Note der Front"],
        fields: [
          { key: "pblk", scope: "team", input: "number",
            label: ["Pass block grade", "Pass block grade", "Pass-Block-Note"] },
          { key: "prsh", scope: "team", input: "number",
            label: ["Pass rush grade", "Pass rush grade", "Pass-Rush-Note"] },
        ] },
    ],
  },
  {
    id: "M8", phase: "game", block: BLOCK_CALL, required: true, notes: "single",
    title: ["Thesis & game script", "Tez & maç senaryosu", "These & Spielverlauf"],
    why: ["Who leads, who has to throw — this is what every player note hangs on.",
          "Kim önde olur, kim pas atmak zorunda kalır — her oyuncu notu buna asılır.",
          "Wer führt, wer muss werfen — daran hängt jede Spielernotiz."],
    fields: [
      { key: "scoreAway", scope: "single", input: "number",
        label: ["Projected score — away", "Skor tahmini — deplasman",
                "Ergebnisprognose — auswärts"] },
      { key: "scoreHome", scope: "single", input: "number",
        label: ["Projected score — home", "Skor tahmini — ev", "Ergebnisprognose — heim"] },
      { key: "spreadLean", scope: "single", input: "select", options: LEAN_SIDE,
        label: ["Spread lean", "Spread yönü", "Spread-Tendenz"] },
      { key: "totalLean", scope: "single", input: "select", options: LEAN_TOTAL,
        label: ["Total lean", "Total yönü", "Total-Tendenz"] },
      CONFIDENCE,
    ],
    sources: [
      { tool: "pff.greenline",
        bring: ["Does the model agree with your thesis? Disagreement is a warning, not a veto.",
                "Model tezinle uyuşuyor mu? Uyuşmaması veto değil, uyarıdır.",
                "Stimmt das Modell mit deiner These überein? Abweichung ist eine Warnung."] },
      { tool: "pff.bestGameBets",
        bring: ["Which side of this game they land on",
                "Bu maçın hangi tarafında durduklarına bak",
                "Auf welcher Seite dieses Spiels sie stehen"] },
      { tool: "pff.keyInsights",
        bring: ["A last cross-check before you commit",
                "Karar vermeden son bir çapraz kontrol",
                "Ein letzter Gegencheck vor der Entscheidung"] },
    ],
  },
];

export const PLAYER_STEPS: StepDef[] = [
  {
    id: "P1", phase: "player", block: BLOCK_ROLE, required: true, notes: "single",
    title: ["Role & volume", "Rol & hacim", "Rolle & Volumen"],
    why: ["Volume comes before everything else — talent without touches pays nothing.",
          "Hacim her şeyden önce gelir — dokunmadan yetenek para etmez.",
          "Volumen kommt zuerst — Talent ohne Ballkontakte zahlt nicht."],
    sources: [
      { tool: "hashtag.targetShares", pos: ["WR", "TE", "RB"],
        bring: ["Target share and its trend",
                "Hedef payı ve trendi", "Target Share und Trend"],
        fields: [{ key: "tgt", scope: "single", input: "number", suffix: "%",
                   label: ["Target share", "Hedef payı", "Target Share"] }] },
      { tool: "hashtag.carries", pos: ["RB", "QB"],
        bring: ["Carry count and its split with the backfield",
                "Koşu sayısı ve backfield paylaşımı",
                "Laufversuche und Aufteilung im Backfield"] },
      { tool: "hashtag.rbWorkload", pos: ["RB"],
        bring: ["Workload profile — early down, passing down, goal line",
                "İş yükü profili — erken down, pas downu, gol çizgisi",
                "Einsatzprofil — Early Down, Passing Down, Goal Line"] },
      { tool: "hashtag.snapShares",
        bring: ["Snap share — the floor under everything else",
                "Snap payı — geri kalan her şeyin tabanı",
                "Snap Share — die Basis für alles andere"] },
      { tool: "pff.fantasyStats",
        bring: ["Red zone usage from the Red Zone Reports",
                "Red Zone Reports'tan kırmızı bölge kullanımı",
                "Red-Zone-Nutzung aus den Red Zone Reports"] },
    ],
  },
  {
    id: "P2", phase: "player", block: BLOCK_ROLE, required: false, notes: "single",
    title: ["Efficiency & quality", "Verimlilik & kalite", "Effizienz & Qualität"],
    why: ["Is the production earned, or is it the situation doing the work?",
          "Üretim hak edilmiş mi, işi durum mu yapıyor?",
          "Ist die Produktion verdient oder macht die Situation die Arbeit?"],
    sources: [
      { tool: "pff.premiumStats",
        bring: ["The player's facet grade (receiving, rushing, passing)",
                "Oyuncunun facet grade'i (receiving, rushing, passing)",
                "Facet-Note des Spielers"],
        fields: [{ key: "grade", scope: "single", input: "number",
                   label: ["PFF grade", "PFF grade", "PFF-Note"] }] },
      { tool: "hashtag.qbEfficiency", pos: ["QB"],
        bring: ["Efficiency profile behind the box score",
                "Box score'un arkasındaki verimlilik profili",
                "Effizienzprofil hinter dem Box Score"] },
      { tool: "hashtag.rbElusiveness", pos: ["RB"],
        bring: ["Yards created on his own",
                "Kendi yarattığı yardalar", "Selbst erarbeitete Yards"] },
      { tool: "hashtag.slotProduction", pos: ["WR", "TE"],
        bring: ["Slot vs wide production — decides which defender he sees",
                "Slot vs dış üretim — hangi savunmacıyı göreceğini belirler",
                "Slot- vs. Outside-Produktion"] },
      { tool: "hashtag.receptionRate", pos: ["WR", "TE", "RB"],
        bring: ["Catch rate on his target diet",
                "Aldığı hedeflerdeki yakalama oranı", "Fangquote bei seinen Targets"] },
    ],
  },
  {
    id: "P3", phase: "player", block: BLOCK_EDGE_P, required: true, notes: "single",
    title: ["Matchup", "Eşleşme", "Matchup"],
    why: ["Who lines up across from him, and how does that defense treat his position?",
          "Karşısında kim var, o savunma bu pozisyona nasıl davranıyor?",
          "Wer steht ihm gegenüber, und wie behandelt diese Defense seine Position?"],
    sources: [
      { tool: "pff.wrCb", pos: ["WR", "TE"],
        bring: ["Matchup advantage and whether a corner shadows him",
                "Matchup advantage ve gölge (shadow) CB var mı",
                "Matchup-Vorteil und ob ein Corner ihn schattet"],
        fields: [{ key: "adv", scope: "single", input: "text",
                   label: ["Matchup advantage / shadow", "Matchup advantage / gölge CB",
                           "Matchup-Vorteil / Shadow"] }] },
      { tool: "pff.matchups",
        bring: ["Their matchup rating for this player this week",
                "Bu hafta bu oyuncu için matchup notu",
                "Ihre Matchup-Bewertung für diese Woche"] },
      { tool: "hashtag.cbCoverage", pos: ["WR", "TE"],
        bring: ["The covering corner's numbers",
                "Kendisini kapatacak cornerback'in sayıları",
                "Die Zahlen des deckenden Cornerbacks"] },
    ],
  },
  {
    id: "P4", phase: "player", block: BLOCK_EDGE_P, required: false, notes: "single",
    title: ["Context & health", "Bağlam & sağlık", "Kontext & Verfassung"],
    why: ["Game script, depth chart and health can move volume more than talent does.",
          "Maç senaryosu, depth chart ve sağlık hacmi yetenekten çok oynatır.",
          "Spielverlauf, Depth Chart und Verfassung bewegen Volumen mehr als Talent."],
    sources: [
      { tool: "hashtag.injury",
        bring: ["His status and the status of whoever is ahead of him",
                "Kendi durumu ve önündeki oyuncunun durumu",
                "Sein Status und der des Spielers vor ihm"] },
      { tool: "fbg.weekly",
        bring: ["The free start/sit take as a sanity check",
                "Ücretsiz start/sit görüşü, akıl sağlığı kontrolü olarak",
                "Die kostenlose Start/Sit-Einschätzung als Gegenprobe"] },
    ],
  },
  {
    id: "P5", phase: "player", block: BLOCK_EDGE_P, required: false, notes: "single",
    title: ["Projection vs line", "Projeksiyon & çizgi", "Prognose vs. Linie"],
    why: ["Three projections and a market price — the gap is the bet.",
          "Üç projeksiyon ve bir piyasa fiyatı — bahis, aradaki fark.",
          "Drei Prognosen und ein Marktpreis — die Lücke ist die Wette."],
    sources: [
      { tool: "pff.playerProps",
        bring: ["Their projection against the posted line",
                "Onların tahmini, açılan çizgiye karşı",
                "Ihre Prognose gegen die angebotene Linie"],
        fields: [{ key: "line", scope: "single", input: "text",
                   label: ["Market line / PFF projection", "Piyasa çizgisi / PFF tahmini",
                           "Marktlinie / PFF-Prognose"] }] },
      { tool: "pff.fantasyProjections",
        bring: ["PFF's fantasy projection",
                "PFF'in fantasy projeksiyonu", "PFFs Fantasy-Prognose"] },
      { tool: "hashtag.projections",
        bring: ["Hashtag's projection — a second opinion on the same week",
                "Hashtag'in projeksiyonu — aynı haftaya ikinci görüş",
                "Hashtags Prognose — eine zweite Meinung"] },
      { tool: "hashtag.consistency",
        bring: ["Boom/bust rate — this is the over/under decision itself",
                "Boom/bust oranı — over/under kararının ta kendisi",
                "Boom/Bust-Quote — genau die Over/Under-Entscheidung"],
        fields: [{ key: "boom", scope: "single", input: "text",
                   label: ["Boom / bust rate", "Boom / bust oranı", "Boom-/Bust-Quote"] }] },
      { tool: "pff.firstTd", pos: ["RB", "WR", "TE", "QB"],
        bring: ["Only if you are looking at a touchdown market",
                "Yalnızca touchdown marketine bakıyorsan",
                "Nur wenn du einen Touchdown-Markt spielst"] },
    ],
  },
  {
    id: "P6", phase: "player", block: BLOCK_CALL, required: true, notes: "single",
    title: ["Call", "Karar", "Entscheidung"],
    why: ["Write the reason down. A lean without a reason cannot be reviewed later.",
          "Gerekçeyi yaz. Gerekçesiz bir yön sonradan denetlenemez.",
          "Schreib die Begründung auf. Eine Tendenz ohne Begründung ist nicht überprüfbar."],
    fields: [
      { key: "market", scope: "single", input: "text",
        label: ["Market", "Market", "Markt"] },
      { key: "lean", scope: "single", input: "select", options: LEAN_PROP,
        label: ["Lean", "Yön", "Tendenz"] },
      CONFIDENCE,
    ],
    sources: [],
  },
];

export const ALL_STEPS = [...GAME_STEPS, ...PLAYER_STEPS];

export const stepById = (id: string): StepDef | undefined =>
  ALL_STEPS.find((s) => s.id === id);

/** Bir oyuncunun pozisyonunda gösterilecek kaynaklar. */
export function sourcesFor(step: StepDef, position?: string): SourceRef[] {
  if (!position) return step.sources;
  return step.sources.filter((s) => !s.pos || s.pos.includes(position));
}

/** Şablonun tamamında geçen araçlar — kapsama panelinin paydası. */
export function toolsInBlueprint(): string[] {
  const seen = new Set<string>();
  for (const step of ALL_STEPS) for (const src of step.sources) seen.add(src.tool);
  return [...seen];
}
