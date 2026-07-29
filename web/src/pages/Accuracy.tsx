import PName from "../components/PName";
import { useMemo, useState } from "react";
import { PlayerScatterChart } from "../components/charts";
import { Loading } from "../components/Pickers";
import { label } from "../lib/columns";
import { useAsync } from "../lib/hooks";
import type { StatRow } from "../lib/types";
import { localized, translate, useI18n } from "../lib/i18n";

const BASE = `${import.meta.env.BASE_URL}data`;

type StatMetrics = Record<string, { n: number; mae: number; bias: number;
                                    corr: number | null }>;
interface EvalPayload {
  generated_at: string;
  data_season: number;
  method: string | Record<string, string>;
  weeks: { week: number; n?: number; stats: StatMetrics;
           methods?: Record<string, StatMetrics> }[];
  players: StatRow[];
}

const STAT_CHOICES = ["receiving_yards", "receptions", "targets",
                      "rushing_yards", "carries", "passing_yards",
                      "passing_tds", "receiving_tds"];
const POS_OF_STAT: Record<string, string[]> = {
  passing_yards: ["QB"], passing_tds: ["QB"],
  rushing_yards: ["RB", "QB"], carries: ["RB", "QB"],
  receiving_yards: ["WR", "TE", "RB"], receptions: ["WR", "TE", "RB"],
  targets: ["WR", "TE", "RB"], receiving_tds: ["WR", "TE"],
};

// pozisyona göre tahmin/gerçek kompakt satır
function pairLine(p: StatRow, kind: "proj" | "act"): string {
  const v = (c: string) => {
    const val = p[`${kind}_${c}`];
    return val !== null && val !== undefined ? String(val) : "—";
  };
  const pos = String(p.position);
  if (pos === "QB")
    return `${v("completions")}/${v("attempts")} · ${v("passing_yards")} yd · ${v("passing_tds")} TD · ${v("passing_interceptions")} int`;
  if (pos === "RB")
    return `${v("carries")} ${translate("u.car")} · ${v("rushing_yards")} ${translate("u.yd")} · ${v("receptions")} rec`;
  return `${v("targets")} tgt · ${v("receptions")} rec · ${v("receiving_yards")} yd`;
}

export default function Accuracy() {
  const { t, lang } = useI18n();
  const [stat, setStat] = useState("receiving_yards");
  const [view, setView] = useState<"stat" | "game">("stat");
  const [gameKey, setGameKey] = useState<string | null>(null);
  const [method, setMethod] = useState<"ml" | "heuristic">("ml");
  const { data, loading } = useAsync(async () => {
    try {
      const res = await fetch(`${BASE}/proj_eval.json`);
      if (!res.ok) return null;
      return (await res.json()) as EvalPayload;
    } catch { return null; }
  }, []);

  const statCols = useMemo(() => {
    const set = new Set<string>();
    for (const w of data?.weeks ?? [])
      for (const s of Object.keys(w.stats)) set.add(s);
    return STAT_CHOICES.filter((s) => set.has(s));
  }, [data]);

  // players tüm değerlendirme haftalarını içerir — seçili haftaya süz
  const [weekChoice, setWeekChoice] = useState<number | null>(null);
  const lastWeek = data?.weeks[data.weeks.length - 1]?.week ?? null;
  const activeWeek = weekChoice ?? lastWeek;
  const wkPlayers = useMemo(() =>
    (data?.players ?? []).filter((p) => Number(p.week) === activeWeek),
    [data, activeWeek]);

  const rows = useMemo(() => {
    const poss = POS_OF_STAT[stat] ?? [];
    return wkPlayers.filter((p) =>
      poss.includes(String(p.position))
      && p[`proj_${stat}`] !== null && p[`act_${stat}`] !== null);
  }, [wkPlayers, stat]);

  const tableRows = useMemo(() =>
    rows
      .map((p): StatRow => ({
        ...p,
        diff: Number((Number(p[`proj_${stat}`]) - Number(p[`act_${stat}`])).toFixed(1)),
      }))
      .sort((a, b) => Number(b[`act_${stat}`]) - Number(a[`act_${stat}`]))
      .slice(0, 40),
    [rows, stat]);

  // seçili haftanın maçları (takım-rakip çiftlerinden)
  const games = useMemo(() => {
    const m = new Map<string, [string, string]>();
    for (const p of wkPlayers) {
      const t = String(p.team), o = String(p.opponent);
      const key = [t, o].sort().join("@");
      if (!m.has(key)) m.set(key, [t, o]);
    }
    return [...m.entries()];
  }, [wkPlayers]);
  const activeGame = games.some(([k]) => k === gameKey)
    ? gameKey : games[0]?.[0] ?? null;
  const gameTeams = games.find(([k]) => k === activeGame)?.[1] ?? null;
  const gameRows = useMemo(() => {
    if (!gameTeams) return [];
    return wkPlayers
      .filter((p) => gameTeams.includes(String(p.team)))
      .sort((a, b) => String(a.team).localeCompare(String(b.team))
        || Number(b.proj_ppr ?? 0) - Number(a.proj_ppr ?? 0));
  }, [wkPlayers, gameTeams]);

  if (loading) return <Loading />;
  if (!data)
    return <p className="empty">{t("acc.notReady")}</p>;

  return (
    <section>
      <h1>{t("acc.title")}</h1>
      <p className="sub">
        {t("acc.sub", { season: data.data_season, n: data.weeks.length,
                        method: localized(data.method, lang) })}
      </p>

      <h2>{t("acc.weeklySummary")}</h2>
      {data.weeks.some((w) => w.methods?.heuristic) && (
        <div className="pill-row">
          <button className={`pill small ${method === "ml" ? "active" : ""}`}
                  onClick={() => setMethod("ml")}>{t("acc.mlBtn")}</button>
          <button className={`pill small ${method === "heuristic" ? "active" : ""}`}
                  onClick={() => setMethod("heuristic")}>{t("acc.heurBtn")}</button>
        </div>
      )}
      <div className="table-wrap">
        <table className="stat-table">
          <thead>
            <tr>
              <th>{t("common.week")}</th>
              {statCols.map((s) => <th key={s} colSpan={3}>{label(s)}</th>)}
            </tr>
            <tr>
              <th className="sub-th"></th>
              {statCols.map((s) => (
                <>
                  <th key={`${s}m`} className="sub-th">MAE</th>
                  <th key={`${s}b`} className="sub-th">Bias</th>
                  <th key={`${s}c`} className="sub-th">r</th>
                </>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.weeks.map((w) => (
              <tr key={w.week}>
                <td>W{w.week}</td>
                {statCols.map((s) => {
                  const m = (w.methods?.[method] ?? w.stats)[s];
                  return m ? (
                    <>
                      <td key={`${s}m`} className="num">{m.mae}</td>
                      <td key={`${s}b`} className="num">
                        {m.bias > 0 ? `+${m.bias}` : m.bias}
                      </td>
                      <td key={`${s}c`} className="num"
                          style={{ color: (m.corr ?? 0) >= 0.5 ? "#3fb950"
                                   : (m.corr ?? 0) < 0.3 ? "#f0883e" : undefined }}>
                        {m.corr ?? "—"}
                      </td>
                    </>
                  ) : (
                    <>
                      <td key={`${s}m`}>—</td><td key={`${s}b`}>—</td>
                      <td key={`${s}c`}>—</td>
                    </>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>{t("acc.predVsActual", { week: activeWeek ?? "" })}</h2>
      <div className="toolbar">
        <div className="pill-row">
          <button className={`pill ${view === "stat" ? "active" : ""}`}
                  onClick={() => setView("stat")}>{t("common.byStat")}</button>
          <button className={`pill ${view === "game" ? "active" : ""}`}
                  onClick={() => setView("game")}>{t("common.byGame")}</button>
        </div>
        <div className="pill-row">
          {data.weeks.map((w) => (
            <button key={w.week}
                    className={`pill small ${w.week === activeWeek ? "active" : ""}`}
                    onClick={() => setWeekChoice(w.week)}>W{w.week}</button>
          ))}
        </div>
      </div>

      {view === "game" && (
        <>
          <div className="pill-row">
            {games.map(([key, [a, b]]) => (
              <button key={key}
                      className={`pill small ${key === activeGame ? "active" : ""}`}
                      onClick={() => setGameKey(key)}>{a} – {b}</button>
            ))}
          </div>
          <div className="table-wrap">
            <table className="stat-table">
              <thead>
                <tr>
                  <th>{t("common.player")}</th><th>{t("common.team")}</th>
                  <th>{t("common.projected")}</th><th>{t("common.actualStat")}</th>
                </tr>
              </thead>
              <tbody>
                {gameRows.map((p) => (
                  <tr key={String(p.player_id)}>
                    <td>
                      <PName name={String(p.player_name)}
                             pos={String(p.position ?? "")}
                             id={String(p.player_id)} />
                    </td>
                    <td>{String(p.team)}</td>
                    <td className="num" style={{ whiteSpace: "nowrap" }}>
                      {pairLine(p, "proj")}
                    </td>
                    <td className="num" style={{ whiteSpace: "nowrap",
                                                 color: "var(--text)" }}>
                      <strong>{pairLine(p, "act")}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {view === "stat" && (
      <>
      <div className="pill-row">
        {statCols.map((s) => (
          <button key={s} className={`pill small ${s === stat ? "active" : ""}`}
                  onClick={() => setStat(s)}>{label(s)}</button>
        ))}
      </div>
      <p className="sub">
        {t("acc.scatterNote")}
      </p>
      <PlayerScatterChart rows={rows} x={`proj_${stat}`} y={`act_${stat}`}
                          labelTop={8} />

      <h2>{t("acc.playerDetail")}</h2>
      <div className="table-wrap">
        <table className="stat-table">
          <thead>
            <tr>
              <th>{t("common.player")}</th><th>{t("common.position")}</th>
              <th>{t("common.team")}</th><th>{t("common.opponent")}</th>
              <th>{t("common.projected")}</th><th>{t("common.actualStat")}</th>
              <th>{t("common.diff")}</th>
            </tr>
          </thead>
          <tbody>
            {tableRows.map((p) => (
              <tr key={String(p.player_id)}>
                <td>
                  <PName name={String(p.player_name)} pos={String(p.position ?? "")}
                         id={String(p.player_id)} />
                </td>
                <td>{String(p.position)}</td>
                <td>{String(p.team)}</td>
                <td>{String(p.opponent)}</td>
                <td className="num">{String(p[`proj_${stat}`])}</td>
                <td className="num">{String(p[`act_${stat}`])}</td>
                <td className="num" style={{
                  color: Math.abs(Number(p.diff)) <= 15 ? "#3fb950" : "#f0883e",
                }}>
                  {Number(p.diff) > 0 ? `+${p.diff}` : String(p.diff)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </>
      )}
    </section>
  );
}
