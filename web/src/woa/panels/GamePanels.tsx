/** Maç adımlarının StatGrade panelleri: her adım kartının içinde, sayfayı
 *  terk etmeden görülen veri. Dış kaynaklardan çekilen hiçbir şey yok — bunlar
 *  tamamen kendi JSON'larımız. */
import { useMemo, type ReactElement } from "react";
import { fmt } from "../../lib/columns";
import { useT } from "../../lib/i18n";
import { etBerlin } from "../../lib/time";
import type { StatRow } from "../../lib/types";
import { rowFor, type GameData } from "../core/data";
import { GAME_STEPS, tx } from "../core/blueprint";
import type { StepState, WoaSession } from "../core/types";
import { CrossDuel, Duel, Empty, Facts, Hint, PanelBox, RankChip } from "../components/ui";

interface PanelProps {
  session: WoaSession;
  data: GameData;
  state?: StepState;
}

const num = (v?: string) => {
  if (!v || v.trim() === "") return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/* ------------------------------------------------------------------ M1 */

function M1({ session, data, state }: PanelProps) {
  const t = useT();
  const row = data.next?.find((g) => String(g.game_id) === session.gameId) ?? null;
  const spread = num(state?.values?.spread);
  const total = num(state?.values?.total);
  const glSpread = num(state?.values?.["pff.greenline.spread"]);
  const glTotal = num(state?.values?.["pff.greenline.total"]);

  // Ev sahibi çizgisi negatifse ev sahibi favori: ev = (total - spread) / 2.
  const implied = spread !== null && total !== null
    ? { away: (total + spread) / 2, home: (total - spread) / 2 }
    : null;

  const h2h = (data.schedule ?? []).filter(
    (g) => (g.away_team === session.away && g.home_team === session.home)
        || (g.away_team === session.home && g.home_team === session.away));

  return (
    <>
      <Facts items={[
        [t("woa.f.kickoff"), `${session.gameday ?? "—"}${
          etBerlin(session.gameday as string, session.gametime as string)
            ? ` · ${etBerlin(session.gameday as string, session.gametime as string)}` : ""}`],
        [t("woa.f.stadium"), String(row?.stadium ?? "—")],
        [t("woa.f.roof"), String(row?.roof ?? "—")],
        [t("woa.f.surface"), String(row?.surface ?? "—")],
        [t("woa.f.rest"), `${row?.away_rest ?? "—"} / ${row?.home_rest ?? "—"}`],
        [t("woa.f.div"), row?.div_game ? t("woa.yes") : t("woa.no")],
      ]} />
      {implied ? (
        <PanelBox title={t("woa.f.implied")}>
          <Facts items={[
            [session.away, implied.away.toFixed(1)],
            [session.home, implied.home.toFixed(1)],
            ...(glSpread !== null || glTotal !== null
              ? [[t("woa.f.greenlineGap"),
                  `${glSpread !== null && spread !== null
                    ? `${t("woa.f.spread")} ${(glSpread - spread) > 0 ? "+" : ""}${(glSpread - spread).toFixed(1)}` : "—"} · ${
                    glTotal !== null && total !== null
                    ? `${t("woa.f.total")} ${(glTotal - total) > 0 ? "+" : ""}${(glTotal - total).toFixed(1)}` : "—"}`,
                 ] as [string, string]]
              : []),
          ]} />
        </PanelBox>
      ) : <Hint>{t("woa.m1.needLine")}</Hint>}
      {h2h.length > 0 && (
        <PanelBox title={t("woa.f.h2h", { season: session.dataSeason })}>
          <ul className="woa-list">
            {h2h.map((g) => (
              <li key={String(g.game_id)}>
                {t("common.weekShort")}{String(g.week)} · {String(g.away_team)}{" "}
                {String(g.away_score ?? "")} @ {String(g.home_team)}{" "}
                {String(g.home_score ?? "")}
              </li>
            ))}
          </ul>
        </PanelBox>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ M2 */

const STARTER_POS = ["QB", "RB", "WR", "TE", "LT", "RT", "C"];

function M2({ session, data }: PanelProps) {
  const t = useT();
  const week = useMemo(() => {
    const weeks = (data.injuries ?? []).map((r) => Number(r.week));
    return weeks.length ? Math.max(...weeks) : null;
  }, [data.injuries]);

  const injuriesFor = (team: string) => (data.injuries ?? []).filter(
    (r) => r.team === team && Number(r.week) === week
        && String(r.report_status ?? "").trim() !== "");

  const startersFor = (team: string) => (data.depth ?? []).filter(
    (r) => r.team === team && String(r.formation) === "3WR 1TE"
        && Number(r.depth) === 1 && STARTER_POS.includes(String(r.position)));

  return (
    <div className="woa-two">
      {[session.away, session.home].map((team) => (
        <PanelBox key={team} title={team}>
          <h5>{t("woa.m2.report")}{week ? ` · ${t("common.weekShort")}${week}` : ""}</h5>
          {injuriesFor(team).length === 0 ? <Empty /> : (
            <ul className="woa-list">
              {injuriesFor(team).slice(0, 12).map((r, i) => (
                <li key={i}>
                  <strong>{String(r.player_name)}</strong>{" "}
                  <span className="woa-dim">{String(r.position)}</span>{" "}
                  <span className="woa-status">{String(r.report_status)}</span>{" "}
                  <span className="woa-dim">{String(r.report_primary_injury ?? "")}</span>
                </li>
              ))}
            </ul>
          )}
          <h5>{t("woa.m2.starters")}</h5>
          {startersFor(team).length === 0 ? <Empty /> : (
            <ul className="woa-list woa-list--inline">
              {startersFor(team).map((r, i) => (
                <li key={i}>
                  <span className="woa-dim">{String(r.position)}</span>{" "}
                  {String(r.player_name)}
                </li>
              ))}
            </ul>
          )}
        </PanelBox>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ M3 */

function arrow(rank?: number | null, prev?: number | null) {
  if (!rank || !prev) return null;
  const delta = prev - rank;
  if (delta === 0) return <span className="woa-dim"> =</span>;
  return <span className={delta > 0 ? "woa-up" : "woa-down"}>
    {delta > 0 ? ` ▲${delta}` : ` ▼${-delta}`}</span>;
}

function M3({ session, data }: PanelProps) {
  const t = useT();
  const power = (team: string) => rowFor(data.power, team);
  const sosFor = (team: string) => (data.sos ?? []).filter((r) => r.team === team);

  const lastGames = (team: string) => (data.schedule ?? [])
    .filter((g) => (g.away_team === team || g.home_team === team)
                && g.home_score !== null && g.home_score !== undefined)
    .slice(-3);

  return (
    <div className="woa-two">
      {[session.away, session.home].map((team) => {
        const p = power(team);
        return (
          <PanelBox key={team} title={team}>
            <Facts items={[
              [t("woa.m3.overall"), <>{p?.overall_rank ? `#${p.overall_rank}` : "—"}</>],
              [t("woa.m3.off"), <>{p?.off_rank ? `#${p.off_rank}` : "—"}
                {arrow(p?.off_rank as number, p?.off_prev_rank as number)}</>],
              [t("woa.m3.def"), <>{p?.def_rank ? `#${p.def_rank}` : "—"}
                {arrow(p?.def_rank as number, p?.def_prev_rank as number)}</>],
              ["PPG", <>{fmt("ppg", p?.ppg ?? null)} / {fmt("papg", p?.papg ?? null)}</>],
            ]} />
            <h5>{t("woa.m3.sos")}</h5>
            <ul className="woa-list woa-list--inline">
              {sosFor(team).map((r, i) => (
                <li key={i}>
                  <span className="woa-dim">{String(r.position)}</span>{" "}
                  <RankChip rank={Number(r.season_rank ?? 0)} />
                </li>
              ))}
            </ul>
            <h5>{t("woa.m3.last3", { season: session.dataSeason })}</h5>
            {lastGames(team).length === 0 ? <Empty /> : (
              <ul className="woa-list woa-list--inline">
                {lastGames(team).map((g) => {
                  const homeSide = g.home_team === team;
                  const own = Number(homeSide ? g.home_score : g.away_score);
                  const opp = Number(homeSide ? g.away_score : g.home_score);
                  return (
                    <li key={String(g.game_id)}
                        className={own > opp ? "woa-up" : own < opp ? "woa-down" : ""}>
                      {own > opp ? "W" : own < opp ? "L" : "T"} {own}-{opp}
                    </li>
                  );
                })}
              </ul>
            )}
          </PanelBox>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ M4 */

const CROSS_PAIRS: [string, string, boolean][] = [
  ["off_epa_play", "def_epa_play", true],
  ["off_success_rate", "def_success_rate", true],
  ["off_explosive_rate", "def_explosive_rate", true],
  ["off_pass_epa", "def_pass_epa", true],
  ["off_rush_epa", "def_rush_epa", true],
  ["off_third_down_conv", "def_third_down_conv", true],
  ["off_rz_td_pct", "def_rz_td_pct", true],
  ["off_turnovers", "def_turnovers", false],
];

function M4({ session, data }: PanelProps) {
  const t = useT();
  return (
    <div className="woa-two">
      <PanelBox title={t("woa.m4.cross", { off: session.away, def: session.home })}>
        <CrossDuel pairs={CROSS_PAIRS} all={data.advanced}
                   offense={session.away} defense={session.home} />
      </PanelBox>
      <PanelBox title={t("woa.m4.cross", { off: session.home, def: session.away })}>
        <CrossDuel pairs={CROSS_PAIRS} all={data.advanced}
                   offense={session.home} defense={session.away} />
      </PanelBox>
    </div>
  );
}

/* ------------------------------------------------------------------ M5 */

function M5({ session, data }: PanelProps) {
  const t = useT();
  const a = rowFor(data.advanced, session.away);
  const h = rowFor(data.advanced, session.home);
  const games = (team: string) => Number(rowFor(data.power, team)?.games ?? 0);
  const perGame = (row: StatRow | null, team: string) => {
    const g = games(team);
    return row && g ? Number(row.off_plays) / g : null;
  };
  const pa = perGame(a, session.away), ph = perGame(h, session.home);

  return (
    <>
      <Duel rows={[["off_plays", true], ["off_pass_rate", true],
                   ["off_epa_play", true], ["def_plays", false]]}
            all={data.advanced} away={session.away} home={session.home} />
      <Facts items={[
        [`${session.away} ${t("woa.m5.perGame")}`, pa ? pa.toFixed(1) : "—"],
        [`${session.home} ${t("woa.m5.perGame")}`, ph ? ph.toFixed(1) : "—"],
        [t("woa.m5.combined"), pa && ph ? (pa + ph).toFixed(0) : "—"],
      ]} />
      <Hint>{t("woa.m5.hint")}</Hint>
    </>
  );
}

/* ------------------------------------------------------------------ M6 */

function M6({ session, data }: PanelProps) {
  const t = useT();
  const a = rowFor(data.scheme, session.away);
  const h = rowFor(data.scheme, session.home);
  const read = (off: StatRow | null, def: StatRow | null,
                offTeam: string, defTeam: string) => {
    if (!off || !def) return null;
    const zone = Number(def.zone_rate), man = Number(def.man_rate);
    const heavy = zone >= man ? "zone" : "man";
    const epa = heavy === "zone" ? off.epa_vs_zone : off.epa_vs_man;
    return t("woa.m6.read", {
      off: offTeam, def: defTeam, scheme: heavy.toUpperCase(),
      rate: fmt(heavy === "zone" ? "zone_rate" : "man_rate",
                heavy === "zone" ? def.zone_rate : def.man_rate),
      epa: fmt("epa_vs_zone", epa ?? null),
    });
  };

  return (
    <>
      <Duel rows={[["man_rate", true], ["zone_rate", true], ["blitz_rate", true],
                   ["blitz_rate_ftn", true], ["avg_box", true],
                   ["avg_pass_rushers", true], ["epa_vs_man", true],
                   ["epa_vs_zone", true]]}
            all={data.scheme} away={session.away} home={session.home} />
      <ul className="woa-list">
        {[read(a, h, session.away, session.home),
          read(h, a, session.home, session.away)]
          .filter(Boolean).map((line, i) => <li key={i}>{line}</li>)}
      </ul>
    </>
  );
}

/* ------------------------------------------------------------------ M7 */

function M7({ session, data }: PanelProps) {
  const t = useT();
  return (
    <>
      <Duel rows={[["off_sack_rate", false], ["def_sack_rate", true],
                   ["off_rush_epa", true], ["def_rush_epa", false]]}
            all={data.advanced} away={session.away} home={session.home} />
      <Duel rows={[["avg_box", true], ["avg_pass_rushers", true],
                   ["blitz_rate", true]]}
            all={data.scheme} away={session.away} home={session.home} />
      <Hint>{t("woa.m7.hint")}</Hint>
    </>
  );
}

/* ------------------------------------------------------------------ M8 */

function M8({ session, state }: PanelProps) {
  const t = useT();
  const m1 = session.steps.M1;
  const spread = num(m1?.values?.spread), total = num(m1?.values?.total);
  const glSpread = num(m1?.values?.["pff.greenline.spread"]);
  const sa = num(state?.values?.scoreAway), sh = num(state?.values?.scoreHome);

  const ownTotal = sa !== null && sh !== null ? sa + sh : null;
  const ownSpread = sa !== null && sh !== null ? sa - sh : null;

  const conflict = glSpread !== null && ownSpread !== null
    && Math.sign(glSpread) !== Math.sign(ownSpread)
    && glSpread !== 0 && ownSpread !== 0;

  return (
    <>
      <PanelBox title={t("woa.m8.written")}>
        <ul className="woa-list woa-recap">
          {GAME_STEPS.filter((s) => s.id !== "M8").map((def) => {
            const st = session.steps[def.id];
            const text = [st?.away, st?.home].filter(Boolean).join(" · ");
            return (
              <li key={def.id}>
                <span className="woa-dim">{def.id}</span> {tx(def.title)}
                {text ? <> — {text}</> : <span className="woa-dim"> · {t("woa.step.empty")}</span>}
              </li>
            );
          })}
        </ul>
      </PanelBox>
      <Facts items={[
        [t("woa.f.market"), spread !== null || total !== null
          ? `${spread ?? "—"} / ${total ?? "—"}` : "—"],
        [t("woa.m8.yours"), ownSpread !== null
          ? `${ownSpread > 0 ? "+" : ""}${ownSpread} / ${ownTotal}` : "—"],
      ]} />
      {conflict && <p className="woa-warn">{t("woa.m8.conflict")}</p>}
    </>
  );
}

/* ------------------------------------------------------------------ dış */

const PANELS: Record<string, (p: PanelProps) => ReactElement | null> = {
  M1, M2, M3, M4, M5, M6, M7, M8,
};

export default function GamePanel({ stepId, ...props }: PanelProps & { stepId: string }) {
  const Panel = PANELS[stepId];
  if (!Panel) return null;
  if (props.data.loading) return <p className="woa-empty">…</p>;
  // Paneller bileşen olarak çizilir, çağrılmaz: her adımın hook kümesi farklı,
  // fonksiyon olarak çağrılırsa hepsi tek bileşenin hook sırasına yazılır.
  return <div className="woa-panel"><Panel {...props} /></div>;
}
