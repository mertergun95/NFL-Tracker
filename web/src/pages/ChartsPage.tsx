import { useMemo, useState } from "react";
import { BarRankingChart, PlayerScatterChart } from "../components/charts";
import PlayerDrawer from "../components/PlayerDrawer";
import { ErrorMsg, Loading, PositionPicker, SeasonPicker } from "../components/Pickers";
import {
  loadNgs, loadPlayerSeason, loadRedzone, loadTeamAdvanced,
  loadTeamScheme, loadTeamSeason,
} from "../lib/data";
import { label } from "../lib/columns";
import { useAsync } from "../lib/hooks";
import type { StatRow } from "../lib/types";

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

const DATASETS = [
  ["season", "Sezon"],
  ["redzone", "Red Zone"],
  ["ngs", "Next Gen"],
] as const;
type Dataset = (typeof DATASETS)[number][0];

const NGS_TYPE: Record<string, "passing" | "rushing" | "receiving"> = {
  QB: "passing", RB: "rushing", WR: "receiving", TE: "receiving",
};

const META_COLS = new Set([
  "week", "season", "games", "player_id", "first_season", "last_season",
]);

// Eksen seçimine göre grafiğin nasıl okunacağını anlatan dinamik rehber
function describeMetric(col: string): string {
  const l = label(col).toLowerCase();
  if (col.includes("epa")) return `${label(col)} (play başına eklenen sayı beklentisi — verimlilik; 0 üstü iyi)`;
  if (col.endsWith("_share") || col.includes("rate") || col.includes("pct"))
    return `${label(col)} (oran — hacimden bağımsız pay/yüzde)`;
  return l;
}

function interpretChart(x: string, y: string, mode: string, view: string): string {
  const entity = mode === "team" ? "takımı" : "oyuncuyu";
  if (view === "bars")
    return `Bu sıralama, ${describeMetric(y)} metriğinde en iyileri gösterir; ` +
      `çubuk ne kadar uzunsa değer o kadar yüksek. Turuncu çubuk arama eşleşmenizdir.`;
  return `Her nokta bir ${entity} temsil eder. Yatay eksen ${describeMetric(x)}, ` +
    `dikey eksen ${describeMetric(y)}. ` +
    `Sağ üst köşe her iki metrikte de yüksek olanlar (genelde en değerliler); ` +
    `sol üst, ${label(x)} düşükken ${label(y)} yükseklere ulaşanlar (verimli ama az hacimli); ` +
    `sağ alt ise yüksek ${label(x)}'e rağmen ${label(y)} üretemeyenlerdir. ` +
    `Eğilimden sapan noktalar (çizgiden uzak olanlar) incelemeye değer hikâyelerdir.`;
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
  const [season, setSeason] = useState(seasons[0]);
  const [mode, setMode] = useState<"player" | "team">("player");
  const [view, setView] = useState<"scatter" | "bars">("scatter");
  const [dataset, setDataset] = useState<Dataset>("season");
  const [pos, setPos] = useState("WR");
  const [axes, setAxes] = useState<Record<string, [string, string]>>({});
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // oyuncu veri setleri
  const { data: seasonRows, error, loading } = useAsync(
    () => loadPlayerSeason(season), [season]);
  const { data: rzRows } = useAsync(() => loadRedzone(season), [season]);
  const ngsType = NGS_TYPE[pos] ?? "receiving";
  const { data: ngsRows } = useAsync(
    () => loadNgs(season, ngsType), [season, ngsType]);

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
  }, [mode, dataset, pos, seasonRows, rzRows, ngsRows, teamRows]);

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
      <h1>Deep Charts</h1>
      <p className="sub">
        Oyuncu (sezon / red zone / Next Gen) ya da takım (temel + advanced + şema)
        verilerinden istediğin iki ekseni seçip dağılımı keşfet. Noktaya
        tıklayınca künye açılır.
      </p>
      <div className="toolbar">
        <div className="pill-row">
          <button className={`pill ${mode === "player" ? "active" : ""}`}
                  onClick={() => setMode("player")}>Oyuncular</button>
          <button className={`pill ${mode === "team" ? "active" : ""}`}
                  onClick={() => setMode("team")}>Takımlar</button>
        </div>
        <SeasonPicker seasons={seasons} value={season} onChange={setSeason} />
      </div>
      {mode === "player" && (
        <div className="toolbar">
          <PositionPicker value={pos} onChange={setPos} />
          <div className="pill-row">
            {DATASETS.map(([key, lbl]) => (
              <button key={key} className={`pill small ${dataset === key ? "active" : ""}`}
                      onClick={() => setDataset(key)}>{lbl}</button>
            ))}
          </div>
        </div>
      )}
      <div className="toolbar">
        <div className="pill-row">
          <button className={`pill small ${view === "scatter" ? "active" : ""}`}
                  onClick={() => setView("scatter")}>◈ Dağılım</button>
          <button className={`pill small ${view === "bars" ? "active" : ""}`}
                  onClick={() => setView("bars")}>▤ Sıralama</button>
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
               placeholder={mode === "team" ? "Takım ara…" : "Oyuncu ara…"}
               value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {x && y && (
        <div className="interpret-box">
          💡 {interpretChart(x, y, mode, view)}
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
        <p className="empty">Bu veri seti bu sezon için mevcut değil.</p>
      )}
      <PlayerDrawer playerId={drawerId} season={season}
                    onClose={() => setDrawerId(null)} />
    </section>
  );
}
