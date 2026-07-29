import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import NcaaLogo from "../../components/NcaaLogo";
import PName from "../../components/PName";
import { Loading } from "../../components/Pickers";
import StatTable from "../../components/StatTable";
import { loadNcaaProjections, loadNcaaTeams, ncaaProjLine,
         teamMapOf } from "../../lib/ncaa";
import { useAsync } from "../../lib/hooks";
import { useT } from "../../lib/i18n";

const POS_COLS: Record<string, string[]> = {
  QB: ["proj_completions", "proj_attempts", "proj_passing_yards",
       "proj_passing_tds", "proj_passing_interceptions", "proj_carries",
       "proj_rushing_yards"],
  RB: ["proj_carries", "proj_rushing_yards", "proj_rushing_tds",
       "proj_receptions", "proj_receiving_yards"],
  WR: ["proj_receptions", "proj_receiving_yards", "proj_receiving_tds"],
  TE: ["proj_receptions", "proj_receiving_yards", "proj_receiving_tds"],
};
const PRIMARY: Record<string, string> = {
  QB: "proj_passing_yards", RB: "proj_rushing_yards",
  WR: "proj_receiving_yards", TE: "proj_receiving_yards",
};

export default function NcaaProjections() {
  const t = useT();
  const [view, setView] = useState<"pos" | "game">("pos");
  const [pos, setPos] = useState("QB");
  const [q, setQ] = useState("");
  const [gameKey, setGameKey] = useState<string | null>(null);
  const { data, loading } = useAsync(() => loadNcaaProjections(), []);
  const { data: teams } = useAsync(() => loadNcaaTeams(), []);
  const tmap = useMemo(() => teamMapOf(teams), [teams]);

  const rows = useMemo(() => {
    let r = (data?.rows ?? []).filter((p) => String(p.position) === pos);
    const s = q.trim().toLowerCase();
    if (s)
      r = r.filter((p) => String(p.player_name).toLowerCase().includes(s)
        || String(p.team).toLowerCase().includes(s));
    return r;
  }, [data, pos, q]);

  // Maç görünümü: takım-rakip çiftleri
  const games = useMemo(() => {
    const m = new Map<string, [string, string]>();
    for (const p of data?.rows ?? []) {
      const t = String(p.team), o = String(p.opponent);
      const key = [t, o].sort().join("@");
      if (!m.has(key)) m.set(key, p.is_home ? [o, t] : [t, o]);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [data]);
  const activeGame = games.some(([k]) => k === gameKey)
    ? gameKey : games[0]?.[0] ?? null;
  const gameTeams = games.find(([k]) => k === activeGame)?.[1] ?? null;
  const gameRows = useMemo(() => {
    if (!gameTeams) return [];
    const prim = (p: Record<string, unknown>) =>
      Number(p[PRIMARY[String(p.position)] ?? "proj_receiving_yards"] ?? 0);
    return (data?.rows ?? [])
      .filter((p) => gameTeams.includes(String(p.team)))
      .sort((a, b) => String(a.team).localeCompare(String(b.team))
        || prim(b) - prim(a));
  }, [data, gameTeams]);

  if (loading) return <Loading />;
  if (!data)
    return <p className="empty">{t("ncaa.projNotReady")}</p>;

  return (
    <section>
      <h1>{t("ncaa.projTitle")}</h1>
      <p className="sub">
        {t("ncaa.projSub", { season: data.target.season, week: data.target.week })}
        <Link to="/ncaa/accuracy">{t("nav.accuracy")}</Link>.
      </p>
      <div className="toolbar">
        <div className="pill-row">
          <button className={`pill ${view === "pos" ? "active" : ""}`}
                  onClick={() => setView("pos")}>{t("common.byPosition")}</button>
          <button className={`pill ${view === "game" ? "active" : ""}`}
                  onClick={() => setView("game")}>{t("common.byGame")}</button>
        </div>
      </div>

      {view === "pos" && (
        <>
          <div className="toolbar">
            <div className="pill-row">
              {Object.keys(POS_COLS).map((p) => (
                <button key={p} className={`pill ${p === pos ? "active" : ""}`}
                        onClick={() => setPos(p)}>{p}</button>
              ))}
            </div>
            <input className="axis-select" placeholder={t("ncaa.searchPlayerTeam")}
                   value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <StatTable rows={rows}
            columns={["player_name", "team", "opponent", ...POS_COLS[pos]]}
            defaultSort={PRIMARY[pos]}
            maxRows={80}
            render={{
              player_name: (r) => (
                <PName name={String(r.player_name)} pos={String(r.position ?? "")}
                       id={String(r.player_id)} base="/ncaa/player" />
              ),
              team: (r) => (
                <Link to={`/ncaa/team/${r.team}`}>{String(r.team)}</Link>
              ),
              opponent: (r) => (
                <Link to={`/ncaa/team/${r.opponent}`}>
                  {(r.is_home ? "vs " : "@ ") + String(r.opponent)}
                </Link>
              ),
            }} />
        </>
      )}

      {view === "game" && (
        <>
          <div className="pill-row">
            {games.map(([key, [a, h]]) => (
              <button key={key}
                      className={`pill small ${key === activeGame ? "active" : ""}`}
                      onClick={() => setGameKey(key)}>{a} @ {h}</button>
            ))}
          </div>
          {gameTeams && (
            <h2>
              <NcaaLogo src={tmap.get(gameTeams[0])?.logo} size={24} />
              {" "}{tmap.get(gameTeams[0])?.school ?? gameTeams[0]}
              {" @ "}
              <NcaaLogo src={tmap.get(gameTeams[1])?.logo} size={24} />
              {" "}{tmap.get(gameTeams[1])?.school ?? gameTeams[1]}
            </h2>
          )}
          <div className="table-wrap">
            <table className="stat-table">
              <thead>
                <tr><th>{t("common.player")}</th><th>{t("common.team")}</th><th>{t("common.projection")}</th></tr>
              </thead>
              <tbody>
                {gameRows.map((p) => (
                  <tr key={String(p.player_id)}>
                    <td>
                      <PName name={String(p.player_name)}
                             pos={String(p.position ?? "")}
                             id={String(p.player_id)} base="/ncaa/player" />
                    </td>
                    <td>{String(p.team)}</td>
                    <td className="num" style={{ whiteSpace: "nowrap" }}>
                      {ncaaProjLine(p, "proj")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
