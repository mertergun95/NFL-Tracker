import { useState } from "react";
import { Link } from "react-router-dom";
import { ErrorMsg, Loading, SeasonPicker } from "../components/Pickers";
import { loadPlayerSeason } from "../lib/data";
import { useAsync } from "../lib/hooks";
import { fmt } from "../lib/columns";
import type { Manifest, StatRow } from "../lib/types";

const LEADER_BOARDS: { title: string; col: string; pos?: string[] }[] = [
  { title: "Pas Yardası", col: "passing_yards", pos: ["QB"] },
  { title: "Koşu Yardası", col: "rushing_yards" },
  { title: "Rec Yardası", col: "receiving_yards" },
  { title: "Pas TD", col: "passing_tds", pos: ["QB"] },
  { title: "Toplam TD (koşu+rec)", col: "_total_td" },
  { title: "Sack (savunma)", col: "def_sacks" },
];

function leaders(rows: StatRow[], col: string, pos: string[] | undefined,
                 count: number): StatRow[] {
  let r = rows;
  if (pos) r = r.filter((p) => pos.includes(String(p.position)));
  const val = (p: StatRow) =>
    col === "_total_td"
      ? Number(p.rushing_tds ?? 0) + Number(p.receiving_tds ?? 0)
      : Number(p[col] ?? 0);
  return [...r]
    .sort((a, b) => val(b) - val(a))
    .slice(0, count)
    .map((p) => ({ ...p, _value: val(p) }));
}

function LeaderCard({ title, col, pos, data }:
  { title: string; col: string; pos?: string[]; data: StatRow[] }) {
  const [expanded, setExpanded] = useState(false);
  const items = leaders(data, col, pos, expanded ? 30 : 5);
  return (
    <div className={`leader-card ${expanded ? "expanded" : ""}`}>
      <h3>{title}</h3>
      <ol>
        {items.map((p) => (
          <li key={String(p.player_id)}>
            <Link to={`/player/${p.player_id}`}>{String(p.player_name)}</Link>
            <span className="leader-team">{String(p.team ?? "")}</span>
            <strong>{fmt(col, p._value as number)}</strong>
          </li>
        ))}
      </ol>
      <button className="leader-toggle" onClick={() => setExpanded(!expanded)}>
        {expanded ? "▴ Daralt" : "▾ Top 30'u göster"}
      </button>
    </div>
  );
}

export default function Dashboard({ manifest, seasons }:
  { manifest: Manifest; seasons: number[] }) {
  const [season, setSeason] = useState(seasons[0]);
  const { data, error, loading } = useAsync(() => loadPlayerSeason(season), [season]);
  const info = manifest.seasons[String(season)];

  return (
    <section>
      <h1>NFL Tracker</h1>
      <p className="sub">
        {seasons.length} sezon yüklü ({seasons[seasons.length - 1]}–{seasons[0]}) ·
        son güncelleme: {manifest.generated_at.slice(0, 10)}
        {info && ` · ${season} REG hafta 1–${info.last_reg_week}`}
      </p>
      <SeasonPicker seasons={seasons} value={season} onChange={setSeason} />
      {loading && <Loading />}
      {error && <ErrorMsg msg={error} />}
      {data && (
        <div className="leader-grid">
          {LEADER_BOARDS.map(({ title, col, pos }) => (
            <LeaderCard key={title} title={title} col={col} pos={pos} data={data} />
          ))}
        </div>
      )}
    </section>
  );
}
