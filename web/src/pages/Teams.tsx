import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import StatTable from "../components/StatTable";
import TeamLogo from "../components/TeamLogo";
import { PlayerScatterChart } from "../components/charts";
import { ErrorMsg, Loading, SeasonPicker } from "../components/Pickers";
import {
  loadOptional, loadTeamAdvanced, loadTeamScheme, loadTeamSeason,
} from "../lib/data";
import { label } from "../lib/columns";
import { useAsync } from "../lib/hooks";
import { teamName } from "../lib/teams";
import type { StatRow } from "../lib/types";
import { useT } from "../lib/i18n";

// izin verilen statlardan pivot edilecekler
const ALLOWED_PIVOT = ["passing_yards", "passing_tds", "rushing_yards",
                       "rushing_tds", "receiving_yards", "receptions",
                       "receiving_tds"];
const CHART_META = new Set(["games", "season"]);

// öne çıkan eksen kombinasyonları (hızlı seçim)
const PRESET_AXES: [string, string, string][] = [
  ["teams.axOffDef", "off_epa_play", "def_epa_play"],
  ["teams.axPoints", "points_for", "points_against"],
  ["teams.axPassRush", "passing_yards", "rushing_yards"],
  ["teams.axAllowed", "allowed_qb_passing_yards", "allowed_rb_rushing_yards"],
  ["teams.axBlitz", "blitz_rate_ftn", "def_sack_rate"],
  ["teams.axMan", "man_rate", "epa_vs_man"],
];

// Kategori -> kolonlar (birleşik takım verisinden)
const CATEGORIES: [string, string, string[]][] = [
  ["ozet", "cat.summary", [
    "team", "wins", "losses", "ties", "points_for", "points_against",
    "off_epa_play", "def_epa_play", "passing_yards", "rushing_yards",
    "passing_interceptions", "def_sacks",
  ]],
  ["hucum", "cat.offense", [
    "team", "completions", "attempts", "passing_yards", "passing_tds",
    "passing_interceptions", "sacks_suffered", "carries", "rushing_yards",
    "rushing_tds", "off_pass_rate", "off_epa_play", "off_pass_epa",
    "off_rush_epa", "off_success_rate", "off_explosive_rate",
    "off_third_down_conv", "off_rz_td_pct", "off_turnovers",
  ]],
  ["savunma", "cat.defense", [
    "team", "points_against", "def_sacks", "def_interceptions",
    "def_epa_play", "def_pass_epa", "def_rush_epa", "def_success_rate",
    "def_explosive_rate", "def_third_down_conv", "def_rz_td_pct",
    "def_sack_rate", "def_turnovers",
  ]],
  ["sema", "cat.scheme", [
    "team", "man_rate", "zone_rate", "epa_vs_man", "epa_vs_zone",
    "blitz_rate", "blitz_rate_ftn", "avg_pass_rushers", "avg_box",
  ]],
];

export default function Teams({ seasons }: { seasons: number[] }) {
  const t = useT();
  const [season, setSeason] = useState(seasons[0]);
  const [cat, setCat] = useState("ozet");
  const [x, setX] = useState("off_epa_play");
  const [y, setY] = useState("def_epa_play");
  const { data, error, loading } = useAsync(async () => {
    const [ts, ta, sch, allowed] = await Promise.all([
      loadTeamSeason(season), loadTeamAdvanced(season), loadTeamScheme(season),
      loadOptional("pos_allowed.json")]);
    const merged = new Map<string, StatRow>();
    for (const src of [ts, ta ?? [], sch ?? []])
      for (const r of src) {
        const key = String(r.team);
        merged.set(key, { ...merged.get(key), ...r });
      }
    // izin verilen statları kolonlara pivotla: allowed_wr_receiving_yards vb.
    for (const r of allowed ?? []) {
      const key = String(r.team);
      const row = merged.get(key);
      if (!row) continue;
      const pos = String(r.position).toLowerCase();
      for (const s of ALLOWED_PIVOT)
        if (typeof r[s] === "number")
          row[`allowed_${pos}_${s}`] = r[s];
    }
    return [...merged.values()];
  }, [season]);

  const chartOptions = useMemo(() => {
    if (!data || data.length === 0) return [];
    const cols = new Set<string>();
    for (const r of data.slice(0, 5))
      for (const [k, v] of Object.entries(r))
        if (typeof v === "number" && !CHART_META.has(k)) cols.add(k);
    return [...cols];
  }, [data]);

  const [, , cols] = CATEGORIES.find(([k]) => k === cat)!;
  const presentCols = useMemo(
    () => cols.filter((c) => c === "team" || data?.some((r) => r[c] !== undefined)),
    [cols, data]);

  return (
    <section>
      <h1>{t("teams.title")}</h1>
      <SeasonPicker seasons={seasons} value={season} onChange={setSeason} />
      {loading && <Loading />}
      {error && <ErrorMsg msg={error} />}
      {data && (
        <>
          <h2>{t("teams.map")}</h2>
          <div className="pill-row">
            {PRESET_AXES.map(([lbl, px, py]) => (
              <button key={lbl}
                      className={`pill small ${x === px && y === py ? "active" : ""}`}
                      onClick={() => { setX(px); setY(py); }}
                      disabled={!chartOptions.includes(px) || !chartOptions.includes(py)}>
                {t(lbl)}
              </button>
            ))}
          </div>
          <div className="toolbar">
            <label className="axis-label">
              X:{" "}
              <select className="axis-select" value={x}
                      onChange={(e) => setX(e.target.value)}>
                {chartOptions.map((s) => <option key={s} value={s}>{label(s)}</option>)}
              </select>
            </label>
            <label className="axis-label">
              Y:{" "}
              <select className="axis-select" value={y}
                      onChange={(e) => setY(e.target.value)}>
                {chartOptions.map((s) => <option key={s} value={s}>{label(s)}</option>)}
              </select>
            </label>
          </div>
          <PlayerScatterChart rows={data} x={x} y={y}
                              nameKey="team" idKey="team" labelTop={32} />
          <div className="tab-row">
            {CATEGORIES.map(([key, lbl]) => (
              <button key={key} className={`tab ${cat === key ? "active" : ""}`}
                      onClick={() => setCat(key)}>{t(lbl)}</button>
            ))}
          </div>
          <p className="sub">
            {t("teams.sortHint")}
          </p>
          <StatTable rows={data} columns={presentCols}
            defaultSort={presentCols[1] ?? "wins"}
            render={{
              team: (row) => (
                <Link to={`/team/${row.team}`} className="team-cell">
                  <TeamLogo abbr={String(row.team)} size={20} />{" "}
                  {teamName(String(row.team))}
                </Link>
              ),
            }}
          />
        </>
      )}
    </section>
  );
}
