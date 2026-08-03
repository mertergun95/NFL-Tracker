import { useMemo, useState } from "react";
import { BarRankingChart, PlayerScatterChart } from "../components/charts";
import PlayerDrawer from "../components/PlayerDrawer";
import { ErrorMsg, Loading, PositionPicker, SeasonPicker } from "../components/Pickers";
import {
  loadNgs, loadPlayerSeason, loadPlayerWeeks, loadRedzone,
  loadTeamAdvanced, loadTeamScheme, loadTeamSeason, loadTeamWeeks,
} from "../lib/data";
import { label, PERCENT_COLS } from "../lib/columns";
import { useAsync } from "../lib/hooks";
import type { StatRow } from "../lib/types";
import { translate, useT } from "../lib/i18n";

const POS_FILTER: Record<string, (p: StatRow) => boolean> = {
  QB: (p) => p.position === "QB",
  RB: (p) => p.position === "RB" || p.position === "FB",
  WR: (p) => p.position === "WR",
  TE: (p) => p.position === "TE",
  K: (p) => p.position === "K",
  DEF: (p) =>
    !["QB", "RB", "FB", "WR", "TE", "K", "P"].includes(String(p.position ?? "")),
};

const DEFAULT_AXES: Record<string, [string, string]> = {
  QB: ["attempts", "passing_epa"],
  RB: ["carry_share", "rushing_yards"],
  WR: ["target_share", "receiving_yards"],
  TE: ["target_share", "receiving_yards"],
  K: ["fg_att", "fg_pct"],
  DEF: ["def_tackles_solo", "def_sacks"],
};

const DATASETS = ["season", "redzone", "ngs"] as const;
type Dataset = (typeof DATASETS)[number];

const NGS_TYPE: Record<string, "passing" | "rushing" | "receiving"> = {
  QB: "passing", RB: "rushing", WR: "receiving", TE: "receiving",
};

const META_COLS = new Set([
  "week", "season", "games", "player_id", "first_season", "last_season",
]);

// Eksen seçimine göre grafiğin nasıl okunacağını anlatan dinamik rehber
function describeMetric(col: string): string {
  const l = label(col).toLowerCase();
  if (col.includes("epa")) return translate("charts.metricEpa", { stat: label(col) });
  if (col.endsWith("_share") || col.includes("rate") || col.includes("pct"))
    return translate("charts.metricRate", { stat: label(col) });
  return l;
}

function interpretChart(x: string, y: string, mode: string, view: string): string {

  if (view === "bars")
    return translate("charts.barsNote", { metric: describeMetric(y) });
  return translate("charts.scatterIntro", {
      entity: translate(mode === "team" ? "charts.entityTeam" : "charts.entityPlayer"),
      x: describeMetric(x), y: describeMetric(y) })
    + translate("charts.scatterNote", { x: label(x), y: label(y) });
}

/** Haftalık satırları [w1,w2] aralığında oyuncu/takım bazında toplar (REG). */
function aggregateWeeks(rows: StatRow[], idKey: string, w1: number, w2: number,
                        metaCols: string[]): StatRow[] {
  const filtered = rows.filter((r) => r.season_type === "REG"
    && Number(r.week) >= w1 && Number(r.week) <= w2);
  const groups = new Map<string, StatRow[]>();
  for (const r of filtered) {
    const k = String(r[idKey]);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(r);
  }
  const out: StatRow[] = [];
  for (const [, g] of groups) {
    const agg: StatRow = { games: g.length };
    for (const m of [idKey, ...metaCols]) agg[m] = g[g.length - 1][m];
    for (const [k, v] of Object.entries(g[0])) {
      if (typeof v !== "number" || k === "week" || k === "season") continue;
      const vals = g.map((r) => Number(r[k] ?? 0));
      agg[k] = PERCENT_COLS.has(k)
        ? Number((vals.reduce((s, x) => s + x, 0) / vals.length).toFixed(3))
        : Number(vals.reduce((s, x) => s + x, 0).toFixed(1));
    }
    out.push(agg);
  }
  return out;
}

function numericCols(rows: StatRow[]): string[] {
  if (rows.length === 0) return [];
  const sample = rows.slice(0, 50);
  const cols = new Set<string>();
  for (const r of sample)
    for (const [k, v] of Object.entries(r))
      if (typeof v === "number" && !META_COLS.has(k)) cols.add(k);
  return [...cols];
}

export default function ChartsPage({ seasons }: { seasons: number[] }) {
  const t = useT();
  const [season, setSeason] = useState(seasons[0]);
  const [mode, setMode] = useState<"player" | "team">("player");
  const [view, setView] = useState<"scatter" | "bars">("scatter");
  const [dataset, setDataset] = useState<Dataset>("season");
  const [pos, setPos] = useState("WR");
  const [axes, setAxes] = useState<Record<string, [string, string]>>({});
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [weekRange, setWeekRange] = useState<[number, number] | null>(null);

  // oyuncu veri setleri
  const { data: seasonRows, error, loading } = useAsync(
    () => loadPlayerSeason(season), [season]);
  const { data: rzRows } = useAsync(() => loadRedzone(season), [season]);
  const ngsType = NGS_TYPE[pos] ?? "receiving";
  const { data: ngsRows } = useAsync(
    () => loadNgs(season, ngsType), [season, ngsType]);

  // hafta aralığı seçiliyse haftalık verilerden topla
  const { data: weekAgg } = useAsync(async () => {
    if (!weekRange) return null;
    const [w1, w2] = weekRange;
    if (mode === "team") {
      const rows = await loadTeamWeeks(season);
      return aggregateWeeks(rows, "team", w1, w2, []);
    }
    const rows = await loadPlayerWeeks(season);
    return aggregateWeeks(rows, "player_id", w1, w2,
                          ["player_name", "position", "team"]);
  }, [season, mode, weekRange?.join()]);

  // takım veri seti: team_season + advanced + şema birleşik
  const { data: teamRows } = useAsync(async () => {
    const [ts, ta, sch] = await Promise.all([
      loadTeamSeason(season), loadTeamAdvanced(season), loadTeamScheme(season)]);
    const merged = new Map<string, StatRow>();
    for (const src of [ts, ta ?? [], sch ?? []])
      for (const r of src) {
        const key = String(r.team);
        merged.set(key, { ...merged.get(key), ...r });
      }
    return [...merged.values()];
  }, [season]);

  const { rows, options, axisKey } = useMemo(() => {
    // hafta aralığı aktifse (yalnızca sezon/temel veri setinde) toplanmış veri
    if (weekRange && weekAgg && (mode === "team" || dataset === "season")) {
      let r = weekAgg;
      if (mode === "player")
        r = r.filter((p) => POS_FILTER[pos](p) && Number(p.games ?? 0) >= 1);
      return { rows: r, options: numericCols(r),
               axisKey: mode === "team" ? "team:wk" : `${pos}:season:wk` };
    }
    if (mode === "team") {
      const r = teamRows ?? [];
      return { rows: r, options: numericCols(r), axisKey: "team" };
    }
    let r: StatRow[] = [];
    if (dataset === "season")
      r = (seasonRows ?? []).filter((p) => POS_FILTER[pos](p)
                                          && Number(p.games ?? 0) >= 6);
    else if (dataset === "redzone")
      r = (rzRows ?? []).filter((p) => POS_FILTER[pos](p));
    else {
      // NGS: week 0 satırı sezon toplamıdır
      r = (ngsRows ?? []).filter((p) => Number(p.week) === 0);
    }
    return { rows: r, options: numericCols(r), axisKey: `${pos}:${dataset}` };
  }, [mode, dataset, pos, seasonRows, rzRows, ngsRows, teamRows,
      weekRange, weekAgg]);

  const defaults: [string, string] = useMemo(() => {
    if (mode === "team") return ["off_epa_play", "def_epa_play"];
    if (dataset === "season") return DEFAULT_AXES[pos];
    const opts = options;
    return [opts[0] ?? "games", opts[1] ?? opts[0] ?? "games"];
  }, [mode, dataset, pos, options]);

  const [x, y] = axes[axisKey]
    ?? (options.includes(defaults[0]) && options.includes(defaults[1])
        ? defaults : [options[0], options[1] ?? options[0]]);

  const setAxis = (i: 0 | 1, v: string) => {
    const cur: [string, string] = [x, y];
    cur[i] = v;
    setAxes({ ...axes, [axisKey]: cur });
  };

  return (
    <section>
      <h1>{t("nav.charts")}</h1>
      <p className="sub">
        {t("charts.sub")}
      </p>
      <div className="toolbar">
        <div className="pill-row">
          <button className={`pill ${mode === "player" ? "active" : ""}`}
                  onClick={() => setMode("player")}>{t("charts.playersBtn")}</button>
          <button className={`pill ${mode === "team" ? "active" : ""}`}
                  onClick={() => setMode("team")}>{t("common.teams")}</button>
        </div>
        <SeasonPicker seasons={seasons} value={season} onChange={setSeason} />
      </div>
      {mode === "player" && (
        <div className="toolbar">
          <PositionPicker value={pos} onChange={setPos} />
          <div className="pill-row">
            {DATASETS.map((key) => (
              <button key={key} className={`pill small ${dataset === key ? "active" : ""}`}
                      onClick={() => setDataset(key)}>{t(`charts.dataset.${key}`)}</button>
            ))}
          </div>
        </div>
      )}
      <div className="toolbar">
        <div className="pill-row">
          <button className={`pill small ${view === "scatter" ? "active" : ""}`}
                  onClick={() => setView("scatter")}>{t("charts.scatter")}</button>
          <button className={`pill small ${view === "bars" ? "active" : ""}`}
                  onClick={() => setView("bars")}>{t("charts.bars")}</button>
        </div>
        {view === "scatter" && (
          <label className="axis-label">
            X:{" "}
            <select className="axis-select" value={x ?? ""}
                    onChange={(e) => setAxis(0, e.target.value)}>
              {options.map((s) => <option key={s} value={s}>{label(s)}</option>)}
            </select>
          </label>
        )}
        <label className="axis-label">
          {view === "bars" ? "Metrik:" : "Y:"}{" "}
          <select className="axis-select" value={y ?? ""}
                  onChange={(e) => setAxis(1, e.target.value)}>
            {options.map((s) => <option key={s} value={s}>{label(s)}</option>)}
          </select>
        </label>
        <input className="search"
               placeholder={t(mode === "team" ? "common.searchTeam" : "common.searchPlayer")}
               value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {(mode === "team" || dataset === "season") && (
        <div className="toolbar">
          <span className="axis-label">{t("charts.weekRange")}</span>
          <button className={`pill small ${weekRange === null ? "active" : ""}`}
                  onClick={() => setWeekRange(null)}>{t("charts.fullSeason")}</button>
          <label className="axis-label">
            <select className="axis-select small"
                    value={weekRange?.[0] ?? 1}
                    onChange={(e) => setWeekRange([Number(e.target.value),
                                                   weekRange?.[1] ?? 18])}>
              {Array.from({ length: 18 }, (_, i) => i + 1).map((w) => (
                <option key={w} value={w}>W{w}</option>
              ))}
            </select>
          </label>
          <span className="axis-label">–</span>
          <label className="axis-label">
            <select className="axis-select small"
                    value={weekRange?.[1] ?? 18}
                    onChange={(e) => setWeekRange([weekRange?.[0] ?? 1,
                                                   Number(e.target.value)])}>
              {Array.from({ length: 18 }, (_, i) => i + 1).map((w) => (
                <option key={w} value={w}>W{w}</option>
              ))}
            </select>
          </label>
          {weekRange && (
            <span className="sub" style={{ margin: 0 }}>
              {t("charts.rangeNote", { from: weekRange[0], to: weekRange[1] })}
            </span>
          )}
        </div>
      )}
      {x && y && (
        <div className="interpret-box">
          {interpretChart(x, y, mode, view)}
        </div>
      )}
      {loading && <Loading />}
      {error && <ErrorMsg msg={error} />}
      {rows.length > 0 && x && y && view === "scatter" && (
        mode === "team"
          ? <PlayerScatterChart rows={rows} x={x} y={y}
              nameKey="team" idKey="team" labelTop={32} highlight={search} />
          : <PlayerScatterChart rows={rows} x={x} y={y} highlight={search}
              onPointClick={(id) => setDrawerId(id)} />
      )}
      {rows.length > 0 && y && view === "bars" && (
        <BarRankingChart rows={rows} metric={y} highlight={search}
          nameKey={mode === "team" ? "team" : "player_name"}
          idKey={mode === "team" ? "team" : "player_id"}
          count={mode === "team" ? 32 : 20}
          onPointClick={mode === "player" ? (id) => setDrawerId(id) : undefined} />
      )}
      {rows.length === 0 && !loading && (
        <p className="empty">{t("charts.datasetMissing")}</p>
      )}
      <PlayerDrawer playerId={drawerId} season={season}
                    onClose={() => setDrawerId(null)} />
    </section>
  );
}
