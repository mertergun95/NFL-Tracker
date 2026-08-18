/** WoA giriş ekranı: yeni analiz başlat, yarım kalanları sürdür. */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import TeamLogo from "../../components/TeamLogo";
import { Loading } from "../../components/Pickers";
import { loadOptional, loadProjections } from "../../lib/data";
import { useAsync } from "../../lib/hooks";
import { useT } from "../../lib/i18n";
import { teamName } from "../../lib/teams";
import { createSession, gameProgress } from "../core/session";
import { saveNew, useSessions } from "../core/store";
import "../woa.css";

export default function WoaHome() {
  const t = useT();
  const navigate = useNavigate();
  const { data: schedule, loading } = useAsync(
    () => loadOptional("next_schedule.json"), []);
  const { data: projections } = useAsync(() => loadProjections(), []);
  const { sessions, remove } = useSessions();

  const weeks = useMemo(
    () => [...new Set((schedule ?? []).map((g) => Number(g.week)))].sort((a, b) => a - b),
    [schedule]);
  const [week, setWeek] = useState<number | null>(null);
  const activeWeek = week ?? projections?.target.week ?? weeks[0] ?? 1;

  const games = useMemo(
    () => (schedule ?? []).filter((g) => Number(g.week) === activeWeek),
    [schedule, activeWeek]);

  async function start(game: Record<string, unknown>) {
    const session = createSession({
      season: Number(game.season),
      week: Number(game.week),
      gameId: String(game.game_id),
      away: String(game.away_team),
      home: String(game.home_team),
      gameday: game.gameday ? String(game.gameday) : undefined,
      gametime: game.gametime ? String(game.gametime) : undefined,
      dataSeason: projections?.data_season ?? Number(game.season) - 1,
    });
    await saveNew(session);
    navigate(`/woa/${session.id}`);
  }

  if (loading) return <Loading />;

  return (
    <section className="woa-home">
      <h1>{t("woa.title")}</h1>
      <p className="sub">{t("woa.sub")}</p>

      <h2>{t("woa.home.new")}</h2>
      <div className="pill-row">
        {weeks.map((w) => (
          <button key={w} className={`pill small${w === activeWeek ? " active" : ""}`}
                  onClick={() => setWeek(w)}>
            {t("common.weekShort")}{w}
          </button>
        ))}
      </div>
      <div className="woa-games">
        {games.map((g) => (
          <button key={String(g.game_id)} className="woa-game"
                  onClick={() => void start(g)}>
            <span><TeamLogo abbr={String(g.away_team)} size={22} />
              {teamName(String(g.away_team))}</span>
            <span className="woa-dim">@</span>
            <span><TeamLogo abbr={String(g.home_team)} size={22} />
              {teamName(String(g.home_team))}</span>
            <span className="woa-dim woa-game__when">{String(g.gameday ?? "")}</span>
          </button>
        ))}
      </div>

      <h2>{t("woa.home.sessions")}</h2>
      {!sessions ? <Loading /> : sessions.length === 0 ? (
        <p className="empty">{t("woa.home.none")}</p>
      ) : (
        <ul className="woa-sessions">
          {sessions.map((s) => {
            const p = gameProgress(s);
            return (
              <li key={s.id}>
                <button className="woa-session" onClick={() => navigate(`/woa/${s.id}`)}>
                  <span className="woa-session__game">
                    <TeamLogo abbr={s.away} size={20} /> {s.away}
                    <span className="woa-dim"> @ </span>
                    <TeamLogo abbr={s.home} size={20} /> {s.home}
                  </span>
                  <span className="woa-dim">
                    {s.season} · {t("common.weekShort")}{s.week}
                  </span>
                  <span className="woa-progress-mini">
                    {p.filled}/{p.total}
                    {s.players.length > 0 && ` · ${s.players.length} ${t("common.player")}`}
                  </span>
                  <span className={`woa-tag woa-tag--${s.status}`}>
                    {t(`woa.status.${s.status}`)}
                  </span>
                </button>
                <button className="woa-del" title={t("woa.home.delete")}
                        onClick={() => void remove(s.id)}>✕</button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
