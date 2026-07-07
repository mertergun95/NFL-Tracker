import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import StatTable from "../components/StatTable";
import { TeamScatterChart } from "../components/charts";
import { ErrorMsg, Loading, SeasonPicker } from "../components/Pickers";
import { loadTeamAdvanced, loadTeamScheme, loadTeamSeason } from "../lib/data";
import { useAsync } from "../lib/hooks";
import { teamName } from "../lib/teams";
import type { StatRow } from "../lib/types";

// Kategori -> kolonlar (birleşik takım verisinden)
const CATEGORIES: [string, string, string[]][] = [
  ["ozet", "Özet", [
    "team", "wins", "losses", "ties", "points_for", "points_against",
    "off_epa_play", "def_epa_play", "passing_yards", "rushing_yards",
    "passing_interceptions", "def_sacks",
  ]],
  ["hucum", "Hücum", [
    "team", "completions", "attempts", "passing_yards", "passing_tds",
    "passing_interceptions", "sacks_suffered", "carries", "rushing_yards",
    "rushing_tds", "off_pass_rate", "off_epa_play", "off_pass_epa",
    "off_rush_epa", "off_success_rate", "off_explosive_rate",
    "off_third_down_conv", "off_rz_td_pct", "off_turnovers",
  ]],
  ["savunma", "Savunma", [
    "team", "points_against", "def_sacks", "def_interceptions",
    "def_epa_play", "def_pass_epa", "def_rush_epa", "def_success_rate",
    "def_explosive_rate", "def_third_down_conv", "def_rz_td_pct",
    "def_sack_rate", "def_turnovers",
  ]],
  ["sema", "Savunma Şeması", [
    "team", "man_rate", "zone_rate", "epa_vs_man", "epa_vs_zone",
    "blitz_rate", "blitz_rate_ftn", "avg_pass_rushers", "avg_box",
  ]],
];

export default function Teams({ seasons }: { seasons: number[] }) {
  const [season, setSeason] = useState(seasons[0]);
  const [cat, setCat] = useState("ozet");
  const { data, error, loading } = useAsync(async () => {
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

  const [, , cols] = CATEGORIES.find(([k]) => k === cat)!;
  const presentCols = useMemo(
    () => cols.filter((c) => c === "team" || data?.some((r) => r[c] !== undefined)),
    [cols, data]);

  return (
    <section>
      <h1>Takım İstatistikleri</h1>
      <SeasonPicker seasons={seasons} value={season} onChange={setSeason} />
      {loading && <Loading />}
      {error && <ErrorMsg msg={error} />}
      {data && (
        <>
          <h2>Hücum vs Savunma Haritası</h2>
          <TeamScatterChart rows={data} />
          <div className="tab-row">
            {CATEGORIES.map(([key, lbl]) => (
              <button key={key} className={`tab ${cat === key ? "active" : ""}`}
                      onClick={() => setCat(key)}>{lbl}</button>
            ))}
          </div>
          <p className="sub">
            Kolon başlıklarına tıklayarak sıralayın — tüm takımları her metrikte
            karşılaştırabilirsiniz.
          </p>
          <StatTable rows={data} columns={presentCols}
            defaultSort={presentCols[1] ?? "wins"}
            render={{
              team: (row) => (
                <Link to={`/team/${row.team}`}>{teamName(String(row.team))}</Link>
              ),
            }}
          />
        </>
      )}
    </section>
  );
}
