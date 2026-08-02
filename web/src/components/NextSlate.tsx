/** Sıradaki maç günü — dashboard'da eksikti: "hafta sonu kim kiminle
 *  oynuyor" sorusuna cevap vermek için Matchups sayfasına gitmek
 *  gerekiyordu. Panel, projeksiyonun hedeflediği haftanın fikstürünü
 *  gösterir ve her satır ilgili matchup analizine bağlanır.
 */
import { Link } from "react-router-dom";
import TeamLogo from "../components/TeamLogo";
import { loadOptional, loadProjections } from "../lib/data";
import { useAsync } from "../lib/hooks";
import { weekLabel, weekTitle } from "../lib/schedule";
import { teamName } from "../lib/teams";
import { etBerlin } from "../lib/time";
import { useT } from "../lib/i18n";

export default function NextSlate() {
  const t = useT();
  const { data: sched } = useAsync(() => loadOptional("next_schedule.json"), []);
  const { data: proj } = useAsync(() => loadProjections(), []);

  const week = proj?.target.week;
  const season = proj?.target.season;
  if (!sched || week === undefined) return null;
  const games = sched.filter((g) => Number(g.week) === week);
  if (games.length === 0) return null;

  const gt = String(games[0].game_type);
  // Aynı güne düşen maçlar birlikte gösterilsin (Perşembe / Pazar / Pazartesi)
  const byDay = new Map<string, typeof games>();
  for (const g of [...games].sort((a, b) =>
    String(a.gameday).localeCompare(String(b.gameday))
    || String(a.gametime).localeCompare(String(b.gametime)))) {
    const d = String(g.gameday);
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d)!.push(g);
  }

  return (
    <>
      <div className="slate-head">
        <h2 title={weekTitle(week, gt)}>
          {t("dash.nextSlate", { season: season ?? "", week: weekLabel(week, gt) })}
        </h2>
        <Link className="drawer-link" to="/matchups">{t("dash.toMatchups")}</Link>
      </div>
      <div className="slate">
        {[...byDay.entries()].map(([day, list]) => (
          <div className="slate-day" key={day}>
            <div className="slate-day-label">{day}</div>
            <div className="slate-games">
              {list.map((g) => {
                const away = String(g.away_team), home = String(g.home_team);
                const kick = etBerlin(g.gameday as string, g.gametime as string);
                return (
                  <Link className="slate-game" to="/matchups"
                        key={String(g.game_id)}
                        title={`${teamName(away)} @ ${teamName(home)}`}>
                    <span className="sg-team">
                      <TeamLogo abbr={away} size={20} />{away}
                    </span>
                    <span className="sg-at">@</span>
                    <span className="sg-team sg-right">
                      {home}<TeamLogo abbr={home} size={20} />
                    </span>
                    {kick && <span className="sg-time">{kick}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
