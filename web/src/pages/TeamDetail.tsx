import PName from "../components/PName";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import StatTable from "../components/StatTable";
import StatTiles, { leagueAverages } from "../components/StatTiles";
import TeamLogo from "../components/TeamLogo";
import { ErrorMsg, Loading, PositionPicker, SeasonPicker } from "../components/Pickers";
import {
  loadOptional, loadPlayerSeason, loadPlayerWeeks, loadSchedule,
  loadTeamAdvanced, loadTeamScheme,
} from "../lib/data";
import { useAsync } from "../lib/hooks";
import { TEAMS, teamName } from "../lib/teams";
import { POSITION_PRESETS } from "../lib/columns";
import type { StatRow } from "../lib/types";

const TABS = [
  ["genel", "Genel"],
  ["logs", "Oyuncu Game Logs"],
  ["against", "Rakiplerin Logları"],
  ["advanced", "Advanced & Şema"],
] as const;

const OFF_TILE_COLS = [
  "off_epa_play", "off_success_rate", "off_pass_epa", "off_rush_epa",
  "off_pass_rate", "off_explosive_rate", "off_third_down_conv",
  "off_rz_td_pct", "off_sack_rate", "off_turnovers",
];
const DEF_TILE_COLS = [
  "def_epa_play", "def_success_rate", "def_pass_epa", "def_rush_epa",
  "def_explosive_rate", "def_third_down_conv", "def_rz_td_pct",
  "def_sack_rate", "def_turnovers",
];
const SCHEME_TILE_COLS = [
  "man_rate", "zone_rate", "epa_vs_man", "epa_vs_zone",
  "blitz_rate", "blitz_rate_ftn", "avg_pass_rushers", "avg_box",
];

const POS_FILTER: Record<string, (p: StatRow) => boolean> = {
  QB: (p) => p.position === "QB",
  RB: (p) => p.position === "RB" || p.position === "FB",
  WR: (p) => p.position === "WR",
  TE: (p) => p.position === "TE",
  K: (p) => p.position === "K",
  DEF: (p) =>
    !["QB", "RB", "FB", "WR", "TE", "K", "P"].includes(String(p.position ?? "")),
};

const LOG_SORT: Record<string, string> = {
  QB: "passing_yards", RB: "rushing_yards", WR: "receiving_yards",
  TE: "receiving_yards", K: "fg_made", DEF: "def_sacks",
};

/** Haftalık game log tablosu (takımın kendi oyuncuları ya da rakip oyuncular). */
function GameLogs({ abbr, season, against }:
  { abbr: string; season: number; against: boolean }) {
  const [pos, setPos] = useState("WR");
  const [week, setWeek] = useState<number | null>(null);
  const { data, error, loading } = useAsync(() => loadPlayerWeeks(season), [season]);

  const rows = useMemo(() => {
    if (!data) return [];
    const key = against ? "opponent_team" : "team";
    let r = data.filter((p) => p[key] === abbr && POS_FILTER[pos](p));
    if (week !== null) r = r.filter((p) => Number(p.week) === week);
    return r;
  }, [data, abbr, against, pos, week]);

  const weeks = useMemo(() => {
    if (!data) return [];
    const key = against ? "opponent_team" : "team";
    return [...new Set(data.filter((p) => p[key] === abbr).map((p) => Number(p.week)))]
      .sort((a, b) => a - b);
  }, [data, abbr, against]);

  const cols = ["week", against ? "team" : "opponent_team", "player_name",
                "position", ...POSITION_PRESETS[pos]];

  return (
    <>
      <p className="sub">
        {against
          ? `${teamName(abbr)} savunmasına karşı rakip oyuncuların maç maç istatistikleri — pozisyona karşı zafiyet analizi için.`
          : `${teamName(abbr)} oyuncularının maç maç istatistikleri.`}
      </p>
      <div className="toolbar">
        <PositionPicker value={pos} onChange={setPos} />
        <div className="pill-row">
          <button className={`pill small ${week === null ? "active" : ""}`}
                  onClick={() => setWeek(null)}>Tüm haftalar</button>
          {weeks.map((w) => (
            <button key={w} className={`pill small ${w === week ? "active" : ""}`}
                    onClick={() => setWeek(w)}>{w}</button>
          ))}
        </div>
      </div>
      {loading && <Loading />}
      {error && <ErrorMsg msg={error} />}
      {data && (
        <StatTable rows={rows} columns={cols} defaultSort={LOG_SORT[pos]} maxRows={150}
          render={{
            player_name: (row) => (
              <PName name={String(row.player_name)} pos={String(row.position ?? "")}
                     id={String(row.player_id)} />
            ),
            team: (row) => <Link to={`/team/${row.team}`}>{String(row.team)}</Link>,
            opponent_team: (row) => (
              <Link to={`/team/${row.opponent_team}`}>
                {String(row.opponent_team ?? "—")}
              </Link>
            ),
          }}
        />
      )}
    </>
  );
}

function AdvancedTab({ abbr, season }: { abbr: string; season: number }) {
  const { data: adv } = useAsync(() => loadTeamAdvanced(season), [season]);
  const { data: scheme } = useAsync(() => loadTeamScheme(season), [season]);
  const advRow = adv?.find((r) => r.team === abbr);
  const schemeRow = scheme?.find((r) => r.team === abbr);
  const advAvg = useMemo(
    () => (adv ? leagueAverages(adv, [...OFF_TILE_COLS, ...DEF_TILE_COLS]) : undefined),
    [adv]);
  const schemeAvg = useMemo(
    () => (scheme ? leagueAverages(scheme, SCHEME_TILE_COLS) : undefined), [scheme]);

  if (!advRow && !schemeRow)
    return <p className="empty">Bu sezon için advanced/şema verisi yok.</p>;
  return (
    <>
      {advRow && (
        <>
          <h2>Hücum (REG, pbp bazlı)</h2>
          <StatTiles row={advRow} cols={OFF_TILE_COLS} avg={advAvg} />
          <h2>Savunma</h2>
          <StatTiles row={advRow} cols={DEF_TILE_COLS} avg={advAvg} />
        </>
      )}
      {schemeRow && (
        <>
          <h2>Savunma Şeması</h2>
          <p className="sub">
            Man/zone ve box verisi katılım (participation) kaynaklıdır;
            blitz (FTN) 2022 sonrası mevcuttur. EPA vs Man/Zone: o coverage'a
            karşı rakibin ürettiği EPA/play (düşük = iyi savunma).
          </p>
          <StatTiles row={schemeRow} cols={SCHEME_TILE_COLS} avg={schemeAvg} />
        </>
      )}
    </>
  );
}

export default function TeamDetail({ seasons }: { seasons: number[] }) {
  const { abbr } = useParams<{ abbr: string }>();
  const [season, setSeason] = useState(seasons[0]);
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("genel");
  const info = abbr ? TEAMS[abbr] : undefined;

  const { data: sched, error: schedErr, loading } = useAsync(async () => {
    const rows = await loadSchedule(season);
    return rows
      .filter((g) => g.home_team === abbr || g.away_team === abbr)
      .sort((a, b) => Number(a.week) - Number(b.week))
      .map((g) => {
        const home = g.home_team === abbr;
        const us = Number(home ? g.home_score : g.away_score);
        const them = Number(home ? g.away_score : g.home_score);
        const played = g.home_score !== null && g.away_score !== null;
        return {
          game_id: g.game_id,
          week: g.week, game_type: g.game_type, gameday: g.gameday,
          opponent: home ? g.away_team : g.home_team,
          where: home ? "Ev" : "Dep",
          score: played ? `${us}-${them}` : "—",
          result: played ? (us > them ? "G" : us < them ? "M" : "B") : "—",
        };
      });
  }, [abbr, season]);

  const { data: roster } = useAsync(async () => {
    const rows = await loadPlayerSeason(season);
    return rows.filter((p) => p.team === abbr);
  }, [abbr, season]);

  const topReceivers = useMemo(
    () => roster?.filter((p) => Number(p.targets ?? 0) > 0) ?? [],
    [roster],
  );

  // Gelecek sezon fikstürü (pipeline'ın next_schedule.json çıktısı)
  const { data: nextFixture } = useAsync(async () => {
    const rows = await loadOptional("next_schedule.json");
    if (!rows) return null;
    return rows
      .filter((g) => g.home_team === abbr || g.away_team === abbr)
      .sort((a, b) => Number(a.week) - Number(b.week))
      .map((g) => ({
        week: g.week, gameday: g.gameday, gametime: g.gametime,
        opponent: g.home_team === abbr ? g.away_team : g.home_team,
        where: g.home_team === abbr ? "Ev" : "Dep",
        season: g.season,
      }));
  }, [abbr]);

  return (
    <section>
      <h1 style={{ borderLeft: `6px solid ${info?.color ?? "#888"}`, paddingLeft: 12,
                   display: "flex", alignItems: "center", gap: 12 }}>
        <TeamLogo abbr={abbr ?? null} size={40} /> {teamName(abbr ?? null)}
      </h1>
      <p className="sub">{info?.division ?? ""}</p>
      <SeasonPicker seasons={seasons} value={season} onChange={setSeason} />

      <div className="tab-row">
        {TABS.map(([key, lbl]) => (
          <button key={key} className={`tab ${tab === key ? "active" : ""}`}
                  onClick={() => setTab(key)}>{lbl}</button>
        ))}
      </div>

      {tab === "genel" && (
        <>
          <h2>Maçlar</h2>
          {loading && <Loading />}
          {schedErr && <ErrorMsg msg={schedErr} />}
          {sched && (
            <StatTable rows={sched}
              columns={["week", "game_type", "gameday", "opponent", "where",
                        "score", "result"]}
              defaultSort="week"
              render={{
                opponent: (row) => (
                  <Link to={`/team/${row.opponent}`}>{String(row.opponent)}</Link>
                ),
                score: (row) => (
                  <Link to={`/game/${season}/${row.game_id}`}>{String(row.score)}</Link>
                ),
              }}
            />
          )}
          {nextFixture && nextFixture.length > 0 && (
            <>
              <h2>{String(nextFixture[0].season)} Fikstürü</h2>
              <StatTable rows={nextFixture}
                columns={["week", "gameday", "gametime", "opponent", "where"]}
                defaultSort="week"
                render={{
                  opponent: (row) => (
                    <Link to={`/team/${row.opponent}`} className="team-cell">
                      <TeamLogo abbr={String(row.opponent)} size={18} />{" "}
                      {String(row.opponent)}
                    </Link>
                  ),
                }}
              />
            </>
          )}
          <h2>Kadro — Sezon İstatistikleri</h2>
          {roster && (
            <StatTable rows={topReceivers}
              columns={["player_name", "position", "games", ...POSITION_PRESETS.WR]}
              defaultSort="receiving_yards" maxRows={40}
              render={{
                player_name: (row) => (
                  <PName name={String(row.player_name)} pos={String(row.position ?? "")}
                         id={String(row.player_id)} />
                ),
              }}
            />
          )}
        </>
      )}

      {tab === "logs" && abbr && (
        <GameLogs abbr={abbr} season={season} against={false} />
      )}
      {tab === "against" && abbr && (
        <GameLogs abbr={abbr} season={season} against={true} />
      )}
      {tab === "advanced" && abbr && <AdvancedTab abbr={abbr} season={season} />}
    </section>
  );
}
