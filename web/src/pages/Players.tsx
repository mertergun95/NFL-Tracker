import PName from "../components/PName";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import StatTable from "../components/StatTable";
import { ErrorMsg, Loading, PositionPicker, SeasonPicker } from "../components/Pickers";
import { loadPlayerSeason } from "../lib/data";
import { POSITION_PRESETS } from "../lib/columns";
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

const DEFAULT_SORT: Record<string, string> = {
  QB: "passing_yards", RB: "rushing_yards", WR: "receiving_yards",
  TE: "receiving_yards", K: "fg_made", DEF: "def_sacks",
};

export default function Players({ seasons }: { seasons: number[] }) {
  const [season, setSeason] = useState(seasons[0]);
  const [pos, setPos] = useState("QB");
  const [search, setSearch] = useState("");
  const { data, error, loading } = useAsync(() => loadPlayerSeason(season), [season]);

  const rows = useMemo(() => {
    if (!data) return [];
    let r = data.filter(POS_FILTER[pos]);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      r = r.filter((p) => String(p.player_name ?? "").toLowerCase().includes(q));
    }
    return r;
  }, [data, pos, search]);

  const columns = ["player_name", "team", "games", ...POSITION_PRESETS[pos]];

  return (
    <section>
      <h1>Oyuncu İstatistikleri</h1>
      <div className="toolbar">
        <SeasonPicker seasons={seasons} value={season} onChange={setSeason} />
        <PositionPicker value={pos} onChange={setPos} />
        <input className="search" placeholder="Oyuncu ara…" value={search}
               onChange={(e) => setSearch(e.target.value)} />
      </div>
      {loading && <Loading />}
      {error && <ErrorMsg msg={error} />}
      {data && (
        <StatTable rows={rows} columns={columns}
          defaultSort={DEFAULT_SORT[pos]} maxRows={100}
          render={{
            player_name: (row) => (
              <PName name={String(row.player_name)} pos={String(row.position ?? "")}
                     id={String(row.player_id)} />
            ),
            team: (row) => (
              <Link to={`/team/${row.team}`}>{String(row.team ?? "—")}</Link>
            ),
          }}
        />
      )}
    </section>
  );
}
