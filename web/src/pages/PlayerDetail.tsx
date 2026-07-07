import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import StatTable from "../components/StatTable";
import { ErrorMsg, Loading, SeasonPicker } from "../components/Pickers";
import { loadPlayerIndex, loadPlayerSeason, loadPlayerWeeks } from "../lib/data";
import { presetForPosition } from "../lib/columns";
import { useAsync } from "../lib/hooks";
import type { StatRow } from "../lib/types";
import { teamName } from "../lib/teams";

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

  return (
    <section>
      <div className="player-header">
        {player?.headshot_url && (
          <img className="headshot" src={String(player.headshot_url)} alt="" />
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
    </section>
  );
}
