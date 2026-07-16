import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PName from "../../components/PName";
import { ErrorMsg, Loading, SeasonPicker } from "../../components/Pickers";
import { label } from "../../lib/columns";
import { loadNcaaPlayerSeason } from "../../lib/ncaa";
import { useAsync } from "../../lib/hooks";

const BOARDS = ["passing_yards", "rushing_yards", "receiving_yards",
                "passing_tds", "rushing_tds", "receiving_tds"];

export default function NcaaDashboard({ seasons }: { seasons: number[] }) {
  const [season, setSeason] = useState(seasons[0]);
  const { data, error, loading } = useAsync(
    () => loadNcaaPlayerSeason(season), [season]);
  const [open, setOpen] = useState<string | null>(null);

  const boards = useMemo(() => BOARDS.map((stat) => ({
    stat,
    rows: (data ?? [])
      .filter((p) => p[stat] !== null && Number(p[stat]) > 0)
      .sort((a, b) => Number(b[stat]) - Number(a[stat]))
      .slice(0, 30),
  })), [data]);

  return (
    <section>
      <h1>NCAA Dashboard</h1>
      <p className="sub">
        FBS (Division I) sezon liderleri — kaynak: ESPN box score'ları,
        her Salı otomatik güncellenir.
      </p>
      <SeasonPicker seasons={seasons} value={season} onChange={setSeason} />
      {loading && <Loading />}
      {error && <ErrorMsg msg={error} />}
      <div className="standings-grid">
        {boards.map(({ stat, rows }) => (
          <div className="standings-card" key={stat}>
            <h3>{label(stat)}</h3>
            <table className="stat-table">
              <tbody>
                {rows.slice(0, open === stat ? 30 : 10).map((p, i) => (
                  <tr key={String(p.player_id)}>
                    <td className="num">{i + 1}</td>
                    <td>
                      <PName name={String(p.player_name)}
                             pos={String(p.position ?? "")}
                             id={String(p.player_id)} base="/ncaa/player" />
                    </td>
                    <td>
                      <Link to={`/ncaa/team/${p.team}`}>{String(p.team)}</Link>
                    </td>
                    <td className="num"><strong>{String(p[stat])}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="pill small"
                    onClick={() => setOpen(open === stat ? null : stat)}>
              {open === stat ? "Daralt" : "İlk 30'u göster"}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
