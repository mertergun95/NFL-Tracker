/** Oyuncu adımlarının StatGrade panelleri. Maç panellerinden ayrıldılar,
 *  çünkü besledikleri dosyalar (haftalık satırlar, NGS) yalnız oyuncu fazında
 *  yüklenir. */
import { useMemo, type ReactElement } from "react";
import { fmt } from "../../lib/columns";
import { useT } from "../../lib/i18n";
import type { StatRow } from "../../lib/types";
import type { GameData, PlayerData } from "../core/data";
import { rowFor } from "../core/data";
import { PLAYER_STEPS, tx } from "../core/blueprint";
import type { PlayerEntry, WoaSession } from "../core/types";
import { Empty, Facts, Hint, PanelBox, RankChip } from "../components/ui";

interface PanelProps {
  session: WoaSession;
  player: PlayerEntry;
  game: GameData;
  data: PlayerData;
}

const avg = (nums: number[]) =>
  nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;

const numbersOf = (rows: StatRow[], col: string) =>
  rows.map((r) => Number(r[col])).filter((n) => Number.isFinite(n));

function useWeeks(props: PanelProps) {
  const { data, player } = props;
  return useMemo(
    () => (data.weeks ?? []).filter((r) => r.player_id === player.playerId),
    [data.weeks, player.playerId]);
}

/** Rakip: oyuncunun takımı hangi tarafsa diğeri. */
const opponentOf = (session: WoaSession, team: string) =>
  team === session.away ? session.home : session.away;

/* ------------------------------------------------------------------ P1 */

function P1(props: PanelProps): ReactElement {
  const t = useT();
  const { data, player } = props;
  const weeks = useWeeks(props);
  const snaps = (data.snaps ?? []).filter((r) => r.player_id === player.playerId);
  const rz = (data.redzone ?? []).find((r) => r.player_id === player.playerId) ?? null;
  const last = snaps.slice(-6);

  // Pozisyonun hacmi neyse o gösterilir: bir QB'nin hedef payı ya da bir
  // WR'ın koşu payı, sıfıra yakın gürültüden başka bir şey değil.
  const share = (col: string) => {
    const v = avg(numbersOf(weeks, col));
    return v === null ? "—" : `${(v * 100).toFixed(1)}%`;
  };
  const perGame = (col: string) => {
    const v = avg(numbersOf(weeks, col));
    return v === null ? "—" : v.toFixed(1);
  };
  const volume: [string, string][] =
    player.position === "QB"
      ? [[t("woa.p1.attPerGame"), perGame("attempts")],
         [t("woa.p1.rushPerGame"), perGame("carries")]]
      : player.position === "RB"
        ? [[t("woa.p1.carryShare"), share("carry_share")],
           [t("woa.p1.tgtShare"), share("target_share")]]
        : [[t("woa.p1.tgtShare"), share("target_share")],
           [t("woa.p1.airShare"), share("air_yards_share")]];

  return (
    <>
      <Facts items={[
        [t("woa.p1.games"), String(weeks.length || "—")],
        [t("woa.p1.snapPct"), (() => {
          const v = avg(numbersOf(last, "offense_pct"));
          return v === null ? "—" : `${(v * 100).toFixed(0)}%`;
        })()],
        ...volume,
      ]} />
      {last.length > 0 && (
        <PanelBox title={t("woa.p1.snapTrend")}>
          <ul className="woa-bars">
            {last.map((r, i) => {
              const pct = Number(r.offense_pct) * 100;
              return (
                <li key={i} title={`${t("common.weekShort")}${r.week} · ${pct.toFixed(0)}%`}>
                  <span className="woa-bar" style={{ height: `${Math.max(4, pct)}%` }} />
                  <span className="woa-dim">{String(r.week)}</span>
                </li>
              );
            })}
          </ul>
        </PanelBox>
      )}
      {rz && (
        <PanelBox title={t("woa.p1.redzone")}>
          <Facts items={[
            ["RZ Tgt", String(rz.rz_targets ?? "—")],
            ["RZ Car", String(rz.rz_carries ?? "—")],
            ["I10 Tgt", String(rz.i10_targets ?? "—")],
            ["I10 Car", String(rz.i10_carries ?? "—")],
            ["RZ TD", String(Number(rz.rz_rec_tds ?? 0) + Number(rz.rz_rush_tds ?? 0))],
          ]} />
        </PanelBox>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ P2 */

const NGS_COLS: Record<string, [string, string][]> = {
  QB: [["avg_time_to_throw", "Time to throw"],
       ["completion_percentage_above_expectation", "CPOE"],
       ["aggressiveness", "Aggressiveness"],
       ["avg_intended_air_yards", "Intended air yds"]],
  RB: [["rush_yards_over_expected_per_att", "RYOE/att"],
       ["percent_attempts_gte_eight_defenders", "8+ box %"],
       ["efficiency", "Efficiency"],
       ["avg_time_to_los", "Time to LOS"]],
  REC: [["avg_separation", "Separation"], ["avg_cushion", "Cushion"],
        ["avg_intended_air_yards", "aDOT"],
        ["percent_share_of_intended_air_yards", "Air yds share"],
        ["avg_yac_above_expectation", "YAC over exp"]],
};

function P2(props: PanelProps): ReactElement {
  const t = useT();
  const { data, player } = props;
  const pos = player.position;
  const source = pos === "QB" ? data.ngsPass : pos === "RB" ? data.ngsRush : data.ngsRec;
  const cols = NGS_COLS[pos === "QB" ? "QB" : pos === "RB" ? "RB" : "REC"];
  const rows = (source ?? []).filter((r) => r.player_id === player.playerId);

  const scheme = (data.playerScheme ?? []).filter(
    (r) => r.player_id === player.playerId);

  return (
    <>
      <PanelBox title="Next Gen Stats">
        {rows.length === 0 ? <Empty /> : (
          <Facts items={cols.map(([col, name]) => {
            const v = avg(numbersOf(rows, col));
            return [name, v === null ? "—" : v.toFixed(2)] as [string, string];
          })} />
        )}
      </PanelBox>
      <PanelBox title={t("woa.p2.splits")}>
        {scheme.length === 0 ? <Empty /> : (
          <table className="woa-duel">
            <thead>
              <tr>
                <th>{t("woa.p2.split")}</th><th>{t("woa.p2.plays")}</th>
                <th>EPA</th><th>Success</th>
              </tr>
            </thead>
            <tbody>
              {scheme.map((r, i) => (
                <tr key={i}>
                  <th scope="row">{String(r.split).replace(/_/g, " ")}</th>
                  <td>{String(r.plays)}</td>
                  <td>{fmt("epa_play", r.epa_play)}</td>
                  <td>{fmt("off_success_rate", r.success_rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </PanelBox>
      <Hint>{t("woa.p2.hint")}</Hint>
    </>
  );
}

/* ------------------------------------------------------------------ P3 */

function P3(props: PanelProps): ReactElement {
  const t = useT();
  const { session, player, game } = props;
  const opp = opponentOf(session, player.team);
  const allowed = (game.allowed ?? []).find(
    (r) => r.team === opp && r.position === player.position) ?? null;
  const scheme = rowFor(game.scheme, opp);

  // Pozisyonun kendi marketleri: bir QB için "yenilen resepsiyon" satırı,
  // bir WR için "yenilen pas yardası" satırı kadar boş.
  const ALLOWED_BY_POS: Record<string, string[]> = {
    QB: ["fantasy_points_ppr", "passing_yards", "passing_tds",
         "passing_interceptions", "rushing_yards"],
    RB: ["fantasy_points_ppr", "carries", "rushing_yards", "rushing_tds",
         "receptions", "receiving_yards"],
    WR: ["fantasy_points_ppr", "receptions", "receiving_yards", "receiving_tds"],
  };
  const cols = ALLOWED_BY_POS[player.position] ?? ALLOWED_BY_POS.WR;

  return (
    <>
      <PanelBox title={t("woa.p3.allowed", { team: opp, pos: player.position })}>
        {!allowed ? <Empty /> : (
          <table className="woa-duel">
            <tbody>
              {cols.filter((col) => allowed[col] !== null
                                 && allowed[col] !== undefined).map((col) => (
                <tr key={col}>
                  <th scope="row">{col.replace(/_/g, " ")}</th>
                  <td>{fmt(col, allowed[col])}</td>
                  <td><RankChip rank={Number(allowed[`rank_${col}`] ?? 0)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </PanelBox>
      <PanelBox title={t("woa.p3.scheme", { team: opp })}>
        {!scheme ? <Empty /> : (
          <Facts items={[
            ["Man %", fmt("man_rate", scheme.man_rate)],
            ["Zone %", fmt("zone_rate", scheme.zone_rate)],
            ["Blitz %", fmt("blitz_rate", scheme.blitz_rate)],
            ["Avg box", fmt("avg_box", scheme.avg_box)],
          ]} />
        )}
      </PanelBox>
      <Hint>{t("woa.p3.hint")}</Hint>
    </>
  );
}

/* ------------------------------------------------------------------ P4 */

function P4(props: PanelProps): ReactElement {
  const t = useT();
  const { player, game, session } = props;
  const injuries = (game.injuries ?? []).filter(
    (r) => r.player_id === player.playerId);
  const latest = injuries.length ? injuries[injuries.length - 1] : null;
  const room = (game.depth ?? [])
    .filter((r) => r.team === player.team && String(r.position) === player.position)
    .sort((a, b) => Number(a.depth) - Number(b.depth));
  const thesis = session.steps.M8?.note;

  return (
    <>
      <PanelBox title={t("woa.p4.status")}>
        {!latest ? <Hint>{t("woa.p4.noReport")}</Hint> : (
          <Facts items={[
            [t("woa.m2.report"), String(latest.report_status ?? "—")],
            [t("woa.p4.injury"), String(latest.report_primary_injury ?? "—")],
            [t("woa.p4.practice"), String(latest.practice_status ?? "—")],
          ]} />
        )}
      </PanelBox>
      <PanelBox title={t("woa.p4.room", { pos: player.position })}>
        {room.length === 0 ? <Empty /> : (
          <ul className="woa-list woa-list--inline">
            {room.map((r, i) => (
              <li key={i} className={r.player_id === player.playerId ? "woa-self" : ""}>
                {String(r.depth)}. {String(r.player_name)}
              </li>
            ))}
          </ul>
        )}
      </PanelBox>
      {thesis && (
        <PanelBox title={t("woa.p4.thesis")}>
          <p className="woa-quote">{thesis}</p>
        </PanelBox>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ P5 */

const PROJ_KEYS = ["ppr", "passing_yards", "passing_tds", "rushing_yards",
                   "receptions", "receiving_yards", "targets", "carries"];

function P5(props: PanelProps): ReactElement {
  const t = useT();
  const { data, player } = props;
  const row = (data.projections ?? []).find((r) => r.player_id === player.playerId) ?? null;

  return (
    <>
      <PanelBox title={t("woa.p5.ours", {
        season: data.projTarget?.season ?? "", week: data.projTarget?.week ?? "" })}>
        {!row ? <Hint>{t("woa.p5.none")}</Hint> : (
          <table className="woa-duel">
            <thead>
              <tr><th /><th>{t("woa.p5.floor")}</th><th>{t("woa.p5.proj")}</th>
                <th>{t("woa.p5.ceiling")}</th></tr>
            </thead>
            <tbody>
              {PROJ_KEYS.filter((k) => row[`proj_${k}`] !== null
                                    && row[`proj_${k}`] !== undefined).map((k) => (
                <tr key={k}>
                  <th scope="row">{k.replace(/_/g, " ")}</th>
                  <td>{fmt(`proj_${k}`, row[`proj_floor_${k}`])}</td>
                  <td><strong>{fmt(`proj_${k}`, row[`proj_${k}`])}</strong></td>
                  <td>{fmt(`proj_${k}`, row[`proj_ceiling_${k}`])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </PanelBox>
      <Hint>{t("woa.p5.hint")}</Hint>
    </>
  );
}

/* ------------------------------------------------------------------ P6 */

function P6(props: PanelProps): ReactElement {
  const t = useT();
  const { player } = props;
  return (
    <PanelBox title={t("woa.p6.recap")}>
      <ul className="woa-list woa-recap">
        {PLAYER_STEPS.filter((s) => s.id !== "P6").map((def) => {
          const note = player.steps[def.id]?.note;
          return (
            <li key={def.id}>
              <span className="woa-dim">{def.id}</span> {tx(def.title)}
              {note ? <> — {note}</>
                    : <span className="woa-dim"> · {t("woa.step.empty")}</span>}
            </li>
          );
        })}
      </ul>
    </PanelBox>
  );
}

const PANELS: Record<string, (p: PanelProps) => ReactElement | null> = {
  P1, P2, P3, P4, P5, P6,
};

export default function PlayerPanel({ stepId, ...props }: PanelProps & { stepId: string }) {
  const Panel = PANELS[stepId];
  if (!Panel) return null;
  if (props.data.loading) return <p className="woa-empty">…</p>;
  // Paneller bileşen olarak çizilir, çağrılmaz: her adımın hook kümesi farklı,
  // fonksiyon olarak çağrılırsa hepsi tek bileşenin hook sırasına yazılır.
  return <div className="woa-panel"><Panel {...props} /></div>;
}
