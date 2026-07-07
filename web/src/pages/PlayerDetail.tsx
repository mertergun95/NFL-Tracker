import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import StatTable from "../components/StatTable";
import { ErrorMsg, Loading, SeasonPicker } from "../components/Pickers";
import {
  loadNgs, loadPlayerIndex, loadPlayerSeason, loadPlayerWeeks,
  loadRedzone, loadSnapCounts,
} from "../lib/data";
import { label, presetForPosition } from "../lib/columns";
import { WeeklyBarChart } from "../components/charts";
import StatTiles from "../components/StatTiles";
import { useAsync } from "../lib/hooks";
import type { StatRow } from "../lib/types";
import { teamName } from "../lib/teams";

const RZ_COLS: Record<string, string[]> = {
  QB: ["rz_pass_att", "rz_pass_tds", "rz_pass_ints", "rz_carries", "rz_rush_tds",
       "i10_pass_att", "i10_pass_tds", "i10_carries", "i10_rush_tds"],
  RB: ["rz_carries", "rz_rush_tds", "rz_targets", "rz_receptions", "rz_rec_tds",
       "i10_carries", "i10_rush_tds", "i10_targets", "i10_rec_tds"],
  REC: ["rz_targets", "rz_receptions", "rz_rec_tds", "rz_carries", "rz_rush_tds",
        "i10_targets", "i10_receptions", "i10_rec_tds"],
};

const NGS_TYPE: Record<string, "passing" | "rushing" | "receiving"> = {
  QB: "passing", RB: "rushing", FB: "rushing", WR: "receiving", TE: "receiving",
};

const NGS_VIEW_COLS: Record<string, string[]> = {
  passing: ["attempts", "pass_yards", "pass_touchdowns", "interceptions",
            "passer_rating", "completion_percentage", "expected_completion_percentage",
            "completion_percentage_above_expectation", "avg_time_to_throw",
            "avg_intended_air_yards", "aggressiveness"],
  rushing: ["rush_attempts", "rush_yards", "rush_touchdowns", "efficiency",
            "percent_attempts_gte_eight_defenders", "avg_time_to_los",
            "expected_rush_yards", "rush_yards_over_expected",
            "rush_yards_over_expected_per_att"],
  receiving: ["targets", "receptions", "yards", "rec_touchdowns", "catch_percentage",
              "avg_separation", "avg_cushion", "avg_intended_air_yards",
              "percent_share_of_intended_air_yards", "avg_yac",
              "avg_yac_above_expectation"],
};

export default function PlayerDetail({ seasons }: { seasons: number[] }) {
  const { id } = useParams<{ id: string }>();
  const [season, setSeason] = useState(seasons[0]);

  const { data: index } = useAsync(() => loadPlayerIndex(), []);
  const player = useMemo(
    () => index?.find((p) => p.player_id === id) ?? null,
    [index, id],
  );

  // Kariyer: her sezonun toplam satırı
  const { data: career, error: careerErr } = useAsync(async () => {
    const per = await Promise.all(
      seasons.map(async (s): Promise<StatRow | null> => {
        try {
          const rows = await loadPlayerSeason(s);
          const row = rows.find((r) => r.player_id === id);
          return row ? { ...row, season: s } : null;
        } catch { return null; }
      }),
    );
    return per
      .filter((r): r is StatRow => r !== null)
      .sort((a, b) => Number(b.season) - Number(a.season));
  }, [id, seasons.join()]);

  const { data: weeks, error: weeksErr, loading } = useAsync(async () => {
    const rows = await loadPlayerWeeks(season);
    return rows
      .filter((r) => r.player_id === id)
      .sort((a, b) => Number(a.week) - Number(b.week));
  }, [id, season]);

  const pos = String(player?.position ?? weeks?.[0]?.position ?? "");
  const stats = presetForPosition(pos || null);
  const [statChoice, setStatChoice] = useState<string | null>(null);
  const chartStat = statChoice ?? stats[0];
  const setChartStat = setStatChoice;

  // Red zone (seçili sezon)
  const { data: rz } = useAsync(async () => {
    const rows = await loadRedzone(season);
    return rows?.find((r) => r.player_id === id) ?? null;
  }, [id, season]);
  const rzCols = RZ_COLS[pos] ?? RZ_COLS.REC;

  // Snap counts (seçili sezon, haftalık)
  const { data: snaps } = useAsync(async () => {
    const rows = await loadSnapCounts(season);
    if (!rows) return null;
    return rows
      .filter((r) => r.player_id === id)
      .sort((a, b) => Number(a.week) - Number(b.week))
      .map((r) => ({ ...r, season_type: r.game_type === "REG" ? "REG" : "POST" }));
  }, [id, season]);
  const snapStat = ["QB", "RB", "FB", "WR", "TE", "K", "P", "T", "G", "C"]
    .includes(pos) ? "offense_pct" : "defense_pct";

  // Next Gen Stats (seçili sezon, pozisyona göre tip)
  const ngsType = NGS_TYPE[pos];
  const { data: ngs } = useAsync(async () => {
    if (!ngsType) return null;
    const rows = await loadNgs(season, ngsType);
    if (!rows) return null;
    return rows
      .filter((r) => r.player_id === id)
      .sort((a, b) => Number(a.week) - Number(b.week));
  }, [id, season, ngsType]);

  return (
    <section>
      <div className="player-header">
        {player?.headshot_url && (
          <img className="headshot" src={String(player.headshot_url)} alt=""
               onError={(e) => { e.currentTarget.style.display = "none"; }} />
        )}
        <div>
          <h1>{String(player?.player_name ?? id)}</h1>
          <p className="sub">
            {pos || "?"} · {teamName(player?.team as string | null)}
            {player && ` · ${player.first_season}–${player.last_season}`}
          </p>
        </div>
      </div>

      <h2>Kariyer (sezon toplamları, REG)</h2>
      {careerErr && <ErrorMsg msg={careerErr} />}
      {career && (
        <StatTable rows={career} columns={["season", "team", "games", ...stats]}
                   defaultSort="season" />
      )}

      <h2>Haftalık Game Log</h2>
      <SeasonPicker seasons={seasons} value={season} onChange={setSeason} />
      {loading && <Loading />}
      {weeksErr && <ErrorMsg msg={weeksErr} />}
      {weeks && weeks.length > 0 && (
        <>
          <div className="pill-row">
            {stats.map((s) => (
              <button key={s} className={`pill small ${s === chartStat ? "active" : ""}`}
                      onClick={() => setChartStat(s)}>
                {label(s)}
              </button>
            ))}
          </div>
          <WeeklyBarChart rows={weeks} stat={chartStat} />
        </>
      )}
      {weeks && (
        <StatTable rows={weeks}
          columns={["week", "season_type", "opponent_team", ...stats]}
          defaultSort="week"
          render={{
            opponent_team: (row) => (
              <Link to={`/team/${row.opponent_team}`}>
                {String(row.opponent_team ?? "—")}
              </Link>
            ),
          }}
        />
      )}

      {rz && (
        <>
          <h2>Red Zone ({season}, REG)</h2>
          <StatTiles row={rz} cols={rzCols} />
        </>
      )}

      {ngs && ngs.length > 0 && (
        <>
          <h2>Advanced — Next Gen Stats ({season})</h2>
          <p className="sub">week 0 satırı sezon toplamıdır.</p>
          <StatTable rows={ngs}
            columns={["week", ...NGS_VIEW_COLS[ngsType!]]}
            defaultSort="week" />
        </>
      )}

      {snaps && snaps.length > 0 && (
        <>
          <h2>Snap Counts ({season})</h2>
          <WeeklyBarChart rows={snaps} stat={snapStat} />
          <StatTable rows={snaps}
            columns={["week", "game_type", "opponent", "offense_snaps",
                      "offense_pct", "defense_snaps", "defense_pct",
                      "st_snaps", "st_pct"]}
            defaultSort="week" />
        </>
      )}
    </section>
  );
}
