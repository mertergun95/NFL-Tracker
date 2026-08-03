import PName from "../components/PName";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import StatTable from "../components/StatTable";
import StatusBadge from "../components/StatusBadge";
import TeamLogo from "../components/TeamLogo";
import { Loading } from "../components/Pickers";
import { loadProjections } from "../lib/data";
import { useAsync } from "../lib/hooks";
import type { StatRow } from "../lib/types";
import { fmt, fmtRange } from "../lib/columns";
import { rangeOf } from "../lib/projText";
import { useT } from "../lib/i18n";

// pozisyona göre gösterilecek GERÇEK stat projeksiyonları
const POS_COLS: Record<string, string[]> = {
  QB: ["proj_attempts", "proj_completions", "proj_passing_yards",
       "proj_passing_tds", "proj_passing_interceptions", "proj_carries",
       "proj_rushing_yards"],
  RB: ["proj_carries", "proj_rushing_yards", "proj_rushing_tds",
       "proj_targets", "proj_receptions", "proj_receiving_yards"],
  WR: ["proj_targets", "proj_receptions", "proj_receiving_yards",
       "proj_receiving_tds"],
  TE: ["proj_targets", "proj_receptions", "proj_receiving_yards",
       "proj_receiving_tds"],
};
const POS_SORT: Record<string, string> = {
  QB: "proj_passing_yards", RB: "proj_rushing_yards",
  WR: "proj_receiving_yards", TE: "proj_receiving_yards",
};
const HEUR_FACTOR_COLS = ["matchup_factor", "scheme_factor", "snap_factor"];
const GAME_COLS = ["proj_passing_yards", "proj_carries", "proj_rushing_yards",
                   "proj_targets", "proj_receptions", "proj_receiving_yards"];
// "Tümü" görünümü: pozisyon farkı gözetmeden bütün stat kolonları
// (sıralama kolonu proj_ppr en başta dursun ki kaydırmadan görünsün)
const ALL_VIEW_COLS = [
  "proj_ppr",
  "proj_attempts", "proj_completions", "proj_passing_yards", "proj_passing_tds",
  "proj_passing_interceptions", "proj_carries", "proj_rushing_yards",
  "proj_rushing_tds", "proj_targets", "proj_receptions", "proj_receiving_yards",
  "proj_receiving_tds",
];
// tüm proj_ kolonları — her biri kendi taban/tavanını hücrenin altında küçük
// gösterir (yalnızca fantasy puanı değil, HER gerçek istatistik için)
const ALL_STAT_COLS = [...new Set([
  ...Object.values(POS_COLS).flat(), ...GAME_COLS, ...ALL_VIEW_COLS,
])];

const ALL = "ALL";
const POSITIONS = [ALL, "QB", "RB", "WR", "TE"];
const POS_FILTER: Record<string, (p: StatRow) => boolean> = {
  QB: (p) => p.position === "QB",
  RB: (p) => p.position === "RB" || p.position === "FB",
  WR: (p) => p.position === "WR",
  TE: (p) => p.position === "TE",
};

/** Arama: isim, takım, rakip ve pozisyon üzerinde eşleşir. */
function makeMatcher(q: string): (p: StatRow) => boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return () => true;
  return (p) =>
    [p.player_name, p.team, p.opponent, p.position]
      .some((v) => String(v ?? "").toLowerCase().includes(needle));
}

/** Her stat hücresi: ana değer + altında küçük taban–tavan (varsa). */
function statCellRender(col: string, showRange: boolean) {
  const stat = col.replace(/^proj_/, "");
  return (row: StatRow) => {
    const main = fmt(col, row[col]);
    if (!showRange) return main;
    const band = rangeOf(row, stat);
    if (!band) return main;
    return (
      <>
        {main}
        <div className="stat-range">{fmtRange(col, band[0], band[1])}</div>
      </>
    );
  };
}

export default function Projections() {
  const t = useT();
  const [pos, setPos] = useState("WR");
  const [view, setView] = useState<"pos" | "game">("pos");
  const [gameKey, setGameKey] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const { data, loading } = useAsync(() => loadProjections(), []);

  const match = useMemo(() => makeMatcher(search), [search]);
  const rows = useMemo(
    () => (data?.rows ?? [])
      .filter(pos === ALL ? () => true : (POS_FILTER[pos] ?? (() => true)))
      .filter(match),
    [data, pos, match]);
  // aramanın başka pozisyonlarda kaç karşılığı var (sonuç boşken ipucu)
  const otherMatches = useMemo(() => {
    if (!search.trim() || rows.length > 0 || pos === ALL) return 0;
    return (data?.rows ?? []).filter(match).length;
  }, [data, match, rows.length, search, pos]);

  // maç bazlı gruplama: away@home anahtarı (takım-rakip çiftinden)
  const games = useMemo(() => {
    const set = new Map<string, [string, string]>();
    for (const p of data?.rows ?? []) {
      const t = String(p.team), o = String(p.opponent);
      const key = [t, o].sort().join("@");
      if (!set.has(key)) set.set(key, [t, o]);
    }
    return [...set.entries()];
  }, [data]);
  const activeGame = gameKey ?? games[0]?.[0] ?? null;
  const gameTeams = games.find(([k]) => k === activeGame)?.[1] ?? null;
  const gameRows = useMemo(
    () => gameTeams
      ? (data?.rows ?? [])
          .filter((p) => gameTeams.includes(String(p.team)))
          .filter(match)
      : [],
    [data, gameTeams, match]);

  if (loading) return <Loading />;
  if (!data)
    return <p className="empty">{t("proj.notReady")}</p>;

  return (
    <section>
      <h1>{t("proj.title", { season: data.target.season,
                             week: data.target.week })}</h1>
      <p className="sub">
        <strong>{t("proj.realStats")}</strong> (P· = {t("common.projection")}).
        {t(data.engine === "ml" ? "proj.mlNote" : "proj.heurNote")}{" "}
        {t("proj.rosterNote")}
        <Link to="/accuracy">{t("nav.accuracy")}</Link>.{" "}
        {t("proj.dataNote", { season: data.data_season })}
        {data.engine === "ml" && <> {t("proj.rangeNote")}</>}
      </p>
      <div className="toolbar">
        <div className="pill-row">
          <button className={`pill ${view === "pos" ? "active" : ""}`}
                  onClick={() => setView("pos")}>{t("common.byPosition")}</button>
          <button className={`pill ${view === "game" ? "active" : ""}`}
                  onClick={() => setView("game")}>{t("common.byGame")}</button>
        </div>
        {view === "pos" && (
          <div className="pill-row">
            {POSITIONS.map((p) => (
              <button key={p} className={`pill ${p === pos ? "active" : ""}`}
                      onClick={() => setPos(p)}>
                {p === ALL ? t("common.all") : p}
              </button>
            ))}
          </div>
        )}
        <input className="search" placeholder={t("common.searchPlayerTeam")}
               value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {view === "game" && (
        <div className="pill-row">
          {games.map(([key, [a, b]]) => (
            <button key={key}
                    className={`pill small game-pill ${key === activeGame ? "active" : ""}`}
                    onClick={() => setGameKey(key)}>
              <TeamLogo abbr={a} size={18} />{a}
              <span className="gp-at">–</span>
              <TeamLogo abbr={b} size={18} />{b}
            </button>
          ))}
        </div>
      )}
      <p className="result-count">
        {t("proj.count", { n: view === "game" ? gameRows.length : rows.length,
                           total: data.rows.length })}
        {otherMatches > 0 && view === "pos" && (
          <>
            {" · "}
            <button className="link-btn" onClick={() => setPos(ALL)}>
              {t("proj.otherPositions", { n: otherMatches })}
            </button>
          </>
        )}
      </p>
      {/* satır sınırı yok: havuzdaki bütün oyuncular listelenir */}
      <StatTable rows={view === "game" ? gameRows : rows}
        columns={view === "game"
          ? ["player_name", "position", "team", "opponent", ...GAME_COLS,
             "injury_status"]
          : pos === ALL
            ? ["player_name", "position", "team", "opponent", ...ALL_VIEW_COLS,
               "injury_status"]
            : ["player_name", "team", "opponent", ...(POS_COLS[pos] ?? []),
               ...(data.engine === "ml" ? [] : HEUR_FACTOR_COLS),
               "injury_status"]}
        defaultSort={view === "game" ? "proj_receiving_yards"
          : pos === ALL ? "proj_ppr" : POS_SORT[pos]}
        render={{
          player_name: (row) => (
            <PName name={String(row.player_name)} pos={String(row.position ?? "")}
                   id={String(row.player_id)} />
          ),
          injury_status: (row) => (
            <StatusBadge status={row.injury_status as string}
                         note={row.injury_note as string} />
          ),
          team: (row) => (
            <Link to={`/team/${row.team}`} className="team-cell">
              <TeamLogo abbr={String(row.team)} size={18} />{String(row.team)}
            </Link>
          ),
          opponent: (row) => (
            <Link to={`/team/${row.opponent}`} className="team-cell">
              <TeamLogo abbr={String(row.opponent)} size={18} />
              {String(row.opponent)}
            </Link>
          ),
          ...Object.fromEntries(
            ALL_STAT_COLS.map((c) => [c, statCellRender(c, data.engine === "ml")])),
        }}
      />
    </section>
  );
}
