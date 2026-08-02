import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import NcaaLogo from "../../components/NcaaLogo";
import { ErrorMsg, Loading, SeasonPicker } from "../../components/Pickers";
import { loadNcaaNextSchedule, loadNcaaSchedule, loadNcaaTeams,
         teamMapOf } from "../../lib/ncaa";
import { useAsync } from "../../lib/hooks";
import { kickoffBerlin } from "../../lib/time";
import { useT } from "../../lib/i18n";

export default function NcaaGames({ seasons }: { seasons: number[] }) {
  const t = useT();
  const navigate = useNavigate();
  const [season, setSeason] = useState(seasons[0]);
  const [wkey, setWkey] = useState("REG-1");
  // Yeni sezon fikstürü (henüz oynanmadıysa sezon listesinin başına eklenir)
  const { data: nextSched } = useAsync(() => loadNcaaNextSchedule(), []);
  const nextSeason = useMemo(() => {
    const s = nextSched?.length ? Number(nextSched[0].season) : null;
    return s !== null && !seasons.includes(s) ? s : null;
  }, [nextSched, seasons]);
  const allSeasons = nextSeason ? [nextSeason, ...seasons] : seasons;
  const { data, error, loading } = useAsync(
    async () => (nextSeason !== null && season === nextSeason)
      ? (nextSched ?? [])
      : loadNcaaSchedule(season),
    [season, nextSeason]);
  const { data: teams } = useAsync(() => loadNcaaTeams(), []);
  const tmap = useMemo(() => teamMapOf(teams), [teams]);

  const weekKeys = useMemo(() => {
    const set = new Set<string>();
    for (const g of data ?? [])
      set.add(`${g.season_type}-${g.week}`);
    return [...set].sort((a, b) => {
      const [ta, wa] = a.split("-"), [tb, wb] = b.split("-");
      if (ta !== tb) return ta === "REG" ? -1 : 1;
      return Number(wa) - Number(wb);
    });
  }, [data]);

  const games = useMemo(() => {
    const [t, w] = wkey.split("-");
    return (data ?? []).filter(
      (g) => g.season_type === t && Number(g.week) === Number(w));
  }, [data, wkey]);

  return (
    <section>
      <h1>{t("ncaa.gamesTitle")}</h1>
      <SeasonPicker seasons={allSeasons} value={season} onChange={setSeason} />
      {nextSeason !== null && season === nextSeason && (
        <p className="sub">{t("ncaa.fixtureNote", { season: nextSeason })}</p>
      )}
      <div className="pill-row">
        {weekKeys.map((k) => (
          <button key={k} className={`pill small ${k === wkey ? "active" : ""}`}
                  onClick={() => setWkey(k)}>
            {k.startsWith("POST") ? t("ncaa.bowlPill") : k.split("-")[1]}
          </button>
        ))}
      </div>
      {loading && <Loading />}
      {error && <ErrorMsg msg={error} />}
      <div className="game-grid">
        {games.map((g) => {
          const played = g.home_score !== null;
          return (
            <div className="game-card" key={String(g.game_id)}
                 onClick={() => {
                   if (played) navigate(`/ncaa/game/${season}/${g.game_id}`);
                 }}>
              <div className="game-date">
                {String(g.gameday)}
                {kickoffBerlin(g.kickoff as string) &&
                  ` · ${kickoffBerlin(g.kickoff as string)} (DE)`}
                {Boolean(g.conference_game) && t("game.conference")}
              </div>
              <div className="game-line">
                <Link to={`/ncaa/team/${g.away_team}`} className="team-cell"
                      onClick={(e) => e.stopPropagation()}>
                  <NcaaLogo src={tmap.get(String(g.away_team))?.logo} size={20} />
                  {" "}{tmap.get(String(g.away_team))?.school ?? String(g.away_team)}
                </Link>
                <strong>{played ? String(g.away_score) : ""}</strong>
              </div>
              <div className="game-line">
                <Link to={`/ncaa/team/${g.home_team}`} className="team-cell"
                      onClick={(e) => e.stopPropagation()}>
                  <NcaaLogo src={tmap.get(String(g.home_team))?.logo} size={20} />
                  {" "}{tmap.get(String(g.home_team))?.school ?? String(g.home_team)}
                </Link>
                <strong>{played ? String(g.home_score) : ""}</strong>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
