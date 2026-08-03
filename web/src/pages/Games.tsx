import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import TeamLogo from "../components/TeamLogo";
import { ErrorMsg, Loading, SeasonPicker } from "../components/Pickers";
import { loadSchedule } from "../lib/data";
import { useAsync } from "../lib/hooks";
import { isPlayoff, typeOfWeek, weekLabel, weekTitle } from "../lib/schedule";
import { teamName } from "../lib/teams";
import { etBerlin } from "../lib/time";
import { useT } from "../lib/i18n";

export default function Games({ seasons }: { seasons: number[] }) {
  const t = useT();
  const navigate = useNavigate();
  const [season, setSeason] = useState(seasons[0]);
  const [week, setWeek] = useState(1);
  const { data, error, loading } = useAsync(() => loadSchedule(season), [season]);

  const weeks = useMemo(() => {
    if (!data) return [];
    return [...new Set(data.map((g) => Number(g.week)))].sort((a, b) => a - b);
  }, [data]);

  const games = useMemo(
    () => (data ?? []).filter((g) => Number(g.week) === week),
    [data, week],
  );

  // Playoff haftaları numarayla değil, turuyla (WLD/DIV/CH/SB) gösterilir;
  // düzenli sezondan da görsel olarak ayrılır.
  const regWeeks = weeks.filter((w) => !isPlayoff(typeOfWeek(data ?? [], w) ?? ""));
  const postWeeks = weeks.filter((w) => isPlayoff(typeOfWeek(data ?? [], w) ?? ""));

  const WeekPill = ({ w }: { w: number }) => {
    const gt = typeOfWeek(data ?? [], w);
    return (
      <button className={`pill small ${w === week ? "active" : ""}`}
              title={weekTitle(w, gt)} onClick={() => setWeek(w)}>
        {weekLabel(w, gt)}
      </button>
    );
  };

  return (
    <section>
      <h1>{t("games.title")}</h1>
      <SeasonPicker seasons={seasons} value={season} onChange={setSeason} />
      <div className="pill-row">
        {regWeeks.map((w) => <WeekPill key={w} w={w} />)}
        {postWeeks.length > 0 && (
          <>
            <span className="pill-sep" aria-hidden="true" />
            {postWeeks.map((w) => <WeekPill key={w} w={w} />)}
          </>
        )}
      </div>
      {loading && <Loading />}
      {error && <ErrorMsg msg={error} />}
      <div className="game-rows">
        {games.map((g) => {
          const played = g.home_score !== null;
          const away = String(g.away_team), home = String(g.home_team);
          const aScore = Number(g.away_score), hScore = Number(g.home_score);
          const kick = etBerlin(g.gameday as string, g.gametime as string);
          return (
            <div className="game-row" key={String(g.game_id)}
                 onClick={() => navigate(`/game/${season}/${g.game_id}`)}>
              <Link to={`/team/${away}`} className="gr-team gr-away"
                    onClick={(e) => e.stopPropagation()}>
                <TeamLogo abbr={away} size={22} />
                <span className="gr-name">{teamName(away)}</span>
                <span className="gr-abbr">{away}</span>
              </Link>
              <span className={`gr-score ${played ? "" : "upcoming"}`}>
                {played
                  ? <>
                      <b className={aScore > hScore ? "win" : ""}>{aScore}</b>
                      <i>–</i>
                      <b className={hScore > aScore ? "win" : ""}>{hScore}</b>
                    </>
                  : <span className="gr-vs">@</span>}
              </span>
              <Link to={`/team/${home}`} className="gr-team gr-home"
                    onClick={(e) => e.stopPropagation()}>
                <span className="gr-abbr">{home}</span>
                <span className="gr-name">{teamName(home)}</span>
                <TeamLogo abbr={home} size={22} />
              </Link>
              <span className="gr-meta">
                {String(g.gameday)}{kick ? ` · ${kick} (DE)` : ""}
              </span>
            </div>
          );
        })}
      </div>
      {!loading && games.length === 0 && (
        <p className="empty">{t("common.noGameData")}</p>
      )}
    </section>
  );
}
