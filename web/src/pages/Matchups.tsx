import PName from "../components/PName";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import TeamLogo from "../components/TeamLogo";
import { Loading } from "../components/Pickers";
import {
  loadOptional, loadProjections, loadTeamAdvanced, loadTeamScheme,
} from "../lib/data";
import { fmt, label } from "../lib/columns";
import { useAsync } from "../lib/hooks";
import { teamName } from "../lib/teams";
import type { StatRow } from "../lib/types";

// karşılaştırılacak takım metrikleri: [kolon, yüksek mi iyi]
const POWER_ROWS: [string, boolean][] = [
  ["off_epa_play", true], ["off_pass_epa", true], ["off_rush_epa", true],
  ["off_success_rate", true], ["off_explosive_rate", true], ["off_rz_td_pct", true],
  ["def_epa_play", false], ["def_pass_epa", false], ["def_rush_epa", false],
  ["def_sack_rate", true],
];

const SCHEME_ROWS = ["man_rate", "zone_rate", "blitz_rate_ftn", "avg_pass_rushers"];
const ALLOWED_ROWS: [string, string][] = [
  ["receptions", "Rec verilen"], ["receiving_yards", "Rec Yds verilen"],
  ["receiving_tds", "Rec TD verilen"], ["rushing_yards", "Koşu Yds verilen"],
  ["rushing_tds", "Koşu TD verilen"], ["passing_yards", "Pas Yds verilen"],
];

function rankOf(rows: StatRow[], team: string, col: string, highGood: boolean): number {
  const vals = rows
    .filter((r) => typeof r[col] === "number")
    .sort((a, b) => highGood
      ? Number(b[col]) - Number(a[col])
      : Number(a[col]) - Number(b[col]));
  return vals.findIndex((r) => r.team === team) + 1;
}

function RankChip({ rank }: { rank: number }) {
  if (!rank) return <span className="rank-chip">—</span>;
  const cls = rank <= 8 ? "good" : rank >= 25 ? "bad" : "";
  return <span className={`rank-chip ${cls}`}>#{rank}</span>;
}

export default function Matchups() {
  const { data: sched, loading } = useAsync(
    () => loadOptional("next_schedule.json"), []);
  const { data: projections } = useAsync(() => loadProjections(), []);
  const dataSeason = projections?.data_season;
  const { data: adv } = useAsync(
    async () => (dataSeason ? loadTeamAdvanced(dataSeason) : null), [dataSeason]);
  const { data: scheme } = useAsync(
    async () => (dataSeason ? loadTeamScheme(dataSeason) : null), [dataSeason]);
  const { data: allowed } = useAsync(() => loadOptional("pos_allowed.json"), []);

  const week = projections?.target.week ?? 1;
  const games = useMemo(
    () => (sched ?? []).filter((g) => Number(g.week) === week),
    [sched, week]);
  const [gameIdx, setGameIdx] = useState(0);
  const game = games[gameIdx];

  if (loading) return <Loading />;
  if (!game)
    return <p className="empty">Fikstür verisi yok — pipeline'ı bekleyin.</p>;

  const away = String(game.away_team), home = String(game.home_team);

  const advRow = (t: string) => adv?.find((r) => r.team === t) ?? null;
  const schemeRow = (t: string) => scheme?.find((r) => r.team === t) ?? null;
  const allowedRow = (t: string, pos: string) =>
    allowed?.find((r) => r.team === t && r.position === pos) ?? null;
  const projFor = (t: string) =>
    (projections?.rows ?? []).filter((p) => p.team === t).slice(0, 6);

  return (
    <section>
      <h1>Haftalık Matchup Analizi — {projections?.target.season} W{week}</h1>
      <p className="sub">
        Değerlendirmeler {dataSeason} sezonu verisine dayanır. #1–8 yeşil (iyi),
        #25–32 turuncu (zayıf) lig sırasıdır.
      </p>
      <div className="pill-row">
        {games.map((g, i) => (
          <button key={String(g.game_id)}
                  className={`pill small ${i === gameIdx ? "active" : ""}`}
                  onClick={() => setGameIdx(i)}>
            {String(g.away_team)} @ {String(g.home_team)}
          </button>
        ))}
      </div>

      <div className="game-hero">
        <div>
          <TeamLogo abbr={away} size={44} />
          <Link to={`/team/${away}`}>{teamName(away)}</Link>
        </div>
        <span className="game-at">@</span>
        <div>
          <TeamLogo abbr={home} size={44} />
          <Link to={`/team/${home}`}>{teamName(home)}</Link>
        </div>
        <span className="sub" style={{ marginLeft: "auto" }}>
          {String(game.gameday)}{game.stadium ? ` · ${game.stadium}` : ""}
        </span>
      </div>

      <h2>Güç Karşılaştırması (lig sıralarıyla)</h2>
      <div className="table-wrap">
        <table className="stat-table">
          <thead>
            <tr><th>{away}</th><th></th><th>Metrik</th><th></th><th>{home}</th></tr>
          </thead>
          <tbody>
            {POWER_ROWS.map(([col, highGood]) => {
              const a = advRow(away)?.[col], h = advRow(home)?.[col];
              return (
                <tr key={col}>
                  <td className="num">{fmt(col, a ?? null)}</td>
                  <td><RankChip rank={adv ? rankOf(adv, away, col, highGood) : 0} /></td>
                  <td style={{ textAlign: "center" }}>{label(col)}</td>
                  <td><RankChip rank={adv ? rankOf(adv, home, col, highGood) : 0} /></td>
                  <td className="num">{fmt(col, h ?? null)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {scheme && (
        <>
          <h2>Savunma Şemaları</h2>
          <div className="table-wrap">
            <table className="stat-table">
              <thead>
                <tr><th>{away} Sav.</th><th>Metrik</th><th>{home} Sav.</th></tr>
              </thead>
              <tbody>
                {SCHEME_ROWS.map((col) => (
                  <tr key={col}>
                    <td className="num">{fmt(col, schemeRow(away)?.[col] ?? null)}</td>
                    <td style={{ textAlign: "center" }}>{label(col)}</td>
                    <td className="num">{fmt(col, schemeRow(home)?.[col] ?? null)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {allowed && (
        <>
          <h2>Savunmaların Pozisyonlara Verdiği (maç başı, gerçek istatistik)</h2>
          <div className="matchup-cols">
            {[away, home].map((deff) => (
              <div className="matchup-card" key={deff}>
                <h3><TeamLogo abbr={deff} size={20} /> {deff} savunması</h3>
                {["QB", "RB", "WR", "TE"].map((pos) => {
                  const r = allowedRow(deff, pos);
                  if (!r) return null;
                  return (
                    <div key={pos} className="allowed-row">
                      <strong>{pos}</strong>
                      <span>
                        {ALLOWED_ROWS
                          .filter(([c]) => typeof r[c] === "number"
                                  && Number(r[c]) > 0.05
                                  && ((pos === "QB" && c.startsWith("passing"))
                                      || (pos === "RB" && (c.startsWith("rush") || c === "receptions"))
                                      || ((pos === "WR" || pos === "TE") && c.startsWith("receiv"))))
                          .map(([c, lbl]) =>
                            `${fmt(c, r[c])} ${lbl.toLowerCase()} (#${r[`rank_${c}`]})`)
                          .join(" · ")}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      )}

      {projections && (
        <>
          <h2>Öne Çıkan Oyuncular (projeksiyon)</h2>
          <div className="matchup-cols">
            {[away, home].map((t) => (
              <div className="matchup-card" key={t}>
                <h3><TeamLogo abbr={t} size={20} /> {teamName(t)}</h3>
                {projFor(t).map((p) => {
                  const pos = String(p.position);
                  const line = pos === "QB"
                    ? `${p.proj_passing_yards ?? "—"} pas yd · ${p.proj_passing_tds ?? "—"} TD`
                    : pos === "RB"
                      ? `${p.proj_carries ?? "—"} koşu · ${p.proj_rushing_yards ?? "—"} yd`
                      : `${p.proj_receptions ?? "—"} rec · ${p.proj_receiving_yards ?? "—"} yd`;
                  return (
                    <div key={String(p.player_id)} className="allowed-row">
                      <PName name={String(p.player_name)} pos={pos}
                             id={String(p.player_id)} />
                      <span><strong>{line}</strong></span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
