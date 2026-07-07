import { useMemo, useState } from "react";
import { PlayerScatterChart } from "../components/charts";
import { ErrorMsg, Loading, PositionPicker, SeasonPicker } from "../components/Pickers";
import { loadPlayerSeason } from "../lib/data";
import { POSITION_PRESETS, label } from "../lib/columns";
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

// pozisyona göre mantıklı varsayılan eksenler
const DEFAULT_AXES: Record<string, [string, string]> = {
  QB: ["attempts", "passing_epa"],
  RB: ["carry_share", "rushing_yards"],
  WR: ["target_share", "receiving_yards"],
  TE: ["target_share", "receiving_yards"],
  K: ["fg_att", "fg_pct"],
  DEF: ["def_tackles_solo", "def_sacks"],
};

const EXTRA_STATS = ["games", "carry_share", "target_share_calc",
                     "rush_yds_share", "rec_yds_share"];

export default function ChartsPage({ seasons }: { seasons: number[] }) {
  const [season, setSeason] = useState(seasons[0]);
  const [pos, setPos] = useState("WR");
  const [xy, setXy] = useState<Record<string, [string, string]>>({});
  const { data, error, loading } = useAsync(() => loadPlayerSeason(season), [season]);

  const statOptions = useMemo(() => {
    const base = [...POSITION_PRESETS[pos], ...EXTRA_STATS];
    return [...new Set(base)];
  }, [pos]);

  const [x, y] = xy[pos] ?? DEFAULT_AXES[pos];

  const rows = useMemo(() => {
    if (!data) return [];
    return data.filter((p) => POS_FILTER[pos](p) && Number(p.games ?? 0) >= 6);
  }, [data, pos]);

  const setAxis = (axis: 0 | 1, v: string) => {
    const cur: [string, string] = [...(xy[pos] ?? DEFAULT_AXES[pos])] as [string, string];
    cur[axis] = v;
    setXy({ ...xy, [pos]: cur });
  };

  return (
    <section>
      <h1>Lig Grafikleri</h1>
      <p className="sub">
        Eksenleri seçerek lig genelinde oyuncu dağılımını keşfet
        (min. 6 maç oynayanlar, {season} REG).
      </p>
      <div className="toolbar">
        <SeasonPicker seasons={seasons} value={season} onChange={setSeason} />
        <PositionPicker value={pos} onChange={setPos} />
      </div>
      <div className="toolbar">
        <label className="axis-label">
          X: {" "}
          <select className="axis-select" value={x}
                  onChange={(e) => setAxis(0, e.target.value)}>
            {statOptions.map((s) => <option key={s} value={s}>{label(s)}</option>)}
          </select>
        </label>
        <label className="axis-label">
          Y: {" "}
          <select className="axis-select" value={y}
                  onChange={(e) => setAxis(1, e.target.value)}>
            {statOptions.map((s) => <option key={s} value={s}>{label(s)}</option>)}
          </select>
        </label>
      </div>
      {loading && <Loading />}
      {error && <ErrorMsg msg={error} />}
      {data && <PlayerScatterChart rows={rows} x={x} y={y} />}
    </section>
  );
}
