import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PName from "../../components/PName";
import { ErrorMsg, Loading, SeasonPicker } from "../../components/Pickers";
import StatTable from "../../components/StatTable";
import { loadNcaaPlayerSeason, NCAA_PRESETS } from "../../lib/ncaa";
import { useAsync } from "../../lib/hooks";
import { useT } from "../../lib/i18n";

export default function NcaaPlayers({ seasons }: { seasons: number[] }) {
  const t = useT();
  const [season, setSeason] = useState(seasons[0]);
  const [pos, setPos] = useState("QB");
  const [q, setQ] = useState("");
  const { data, error, loading } = useAsync(
    () => loadNcaaPlayerSeason(season), [season]);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (s)
      return (data ?? []).filter((p) =>
        String(p.player_name).toLowerCase().includes(s));
    return (data ?? []).filter((p) => String(p.position) === pos);
  }, [data, pos, q]);

  const cols = NCAA_PRESETS[pos] ?? NCAA_PRESETS.WR;

  return (
    <section>
      <h1>{t("ncaa.playersTitle")}</h1>
      <div className="toolbar">
        <SeasonPicker seasons={seasons} value={season} onChange={setSeason} />
        <div className="pill-row">
          {Object.keys(NCAA_PRESETS).map((p) => (
            <button key={p} className={`pill ${p === pos && !q ? "active" : ""}`}
                    onClick={() => { setPos(p); setQ(""); }}>{p}</button>
          ))}
        </div>
        <input className="axis-select" placeholder={t("common.searchPlayer")} value={q}
               onChange={(e) => setQ(e.target.value)} />
      </div>
      <p className="sub">
        {t("ncaa.playersSub")}
      </p>
      {loading && <Loading />}
      {error && <ErrorMsg msg={error} />}
      {data && (
        <StatTable rows={rows}
          columns={["player_name", "team", "games", ...cols]}
          defaultSort={cols.includes("passing_yards") ? "passing_yards"
                       : cols[1]}
          maxRows={100}
          render={{
            player_name: (r) => (
              <PName name={String(r.player_name)} pos={String(r.position ?? "")}
                     id={String(r.player_id)} base="/ncaa/player" />
            ),
            team: (r) => (
              <Link to={`/ncaa/team/${r.team}`}>{String(r.team ?? "—")}</Link>
            ),
          }} />
      )}
    </section>
  );
}
