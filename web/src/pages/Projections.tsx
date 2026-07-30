import PName from "../components/PName";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import StatTable from "../components/StatTable";
import StatusBadge from "../components/StatusBadge";
import { Loading } from "../components/Pickers";
import { loadProjections } from "../lib/data";
import { useAsync } from "../lib/hooks";
import type { StatRow } from "../lib/types";
import { fmt } from "../lib/columns";
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
// tüm proj_ kolonları (POS_COLS + GAME_COLS'taki hepsi) — her biri kendi
// taban/tavanını hücrenin altında küçük gösterir (yalnızca fantasy puanı
// değil, HER gerçek istatistik için)
const ALL_STAT_COLS = [...new Set([
  ...Object.values(POS_COLS).flat(), ...GAME_COLS,
])];

const POS_FILTER: Record<string, (p: StatRow) => boolean> = {
  QB: (p) => p.position === "QB",
  RB: (p) => p.position === "RB",
  WR: (p) => p.position === "WR",
  TE: (p) => p.position === "TE",
};

/** Her stat hücresi: ana değer + altında küçük taban–tavan (varsa). */
function statCellRender(col: string, showRange: boolean) {
  const stat = col.replace(/^proj_/, "");
  return (row: StatRow) => {
    const main = fmt(col, row[col]);
    if (!showRange) return main;
    const lo = row[`proj_floor_${stat}`], hi = row[`proj_ceiling_${stat}`];
    if (lo === null || lo === undefined || hi === null || hi === undefined)
      return main;
    return (
      <>
        {main}
        <div className="stat-range">{fmt(col, lo)}–{fmt(col, hi)}</div>
      </>
    );
  };
}

export default function Projections() {
  const t = useT();
  const [pos, setPos] = useState("WR");
  const [view, setView] = useState<"pos" | "game">("pos");
  const [gameKey, setGameKey] = useState<string | null>(null);
  const { data, loading } = useAsync(() => loadProjections(), []);

  const rows = useMemo(
    () => (data?.rows ?? []).filter(POS_FILTER[pos] ?? (() => true)),
    [data, pos]);

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
      ? (data?.rows ?? []).filter((p) => gameTeams.includes(String(p.team)))
      : [],
    [data, gameTeams]);

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
            {["QB", "RB", "WR", "TE"].map((p) => (
              <button key={p} className={`pill ${p === pos ? "active" : ""}`}
                      onClick={() => setPos(p)}>{p}</button>
            ))}
          </div>
        )}
      </div>
      {view === "game" && (
        <div className="pill-row">
          {games.map(([key, [a, b]]) => (
            <button key={key} className={`pill small ${key === activeGame ? "active" : ""}`}
                    onClick={() => setGameKey(key)}>{a} – {b}</button>
          ))}
        </div>
      )}
      <StatTable rows={view === "game" ? gameRows : rows}
        columns={view === "game"
          ? ["player_name", "position", "team", "opponent", ...GAME_COLS,
             "injury_status"]
          : ["player_name", "team", "opponent", ...(POS_COLS[pos] ?? []),
             ...(data.engine === "ml" ? [] : HEUR_FACTOR_COLS),
             "injury_status"]}
        defaultSort={view === "game" ? "proj_receiving_yards" : POS_SORT[pos]}
        maxRows={60}
        render={{
          player_name: (row) => (
            <PName name={String(row.player_name)} pos={String(row.position ?? "")}
                   id={String(row.player_id)} />
          ),
          injury_status: (row) => (
            <StatusBadge status={row.injury_status as string}
                         note={row.injury_note as string} />
          ),
          team: (row) => <Link to={`/team/${row.team}`}>{String(row.team)}</Link>,
          opponent: (row) => (
            <Link to={`/team/${row.opponent}`}>{String(row.opponent)}</Link>
          ),
          ...Object.fromEntries(
            ALL_STAT_COLS.map((c) => [c, statCellRender(c, data.engine === "ml")])),
        }}
      />
    </section>
  );
}
