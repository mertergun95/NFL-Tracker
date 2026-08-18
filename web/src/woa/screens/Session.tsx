/** Analiz oturumu: solda yol haritası, ortada adım kartı, sağda canlı özet. */
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import TeamLogo from "../../components/TeamLogo";
import { ErrorMsg, Loading } from "../../components/Pickers";
import { useT } from "../../lib/i18n";
import { teamName } from "../../lib/teams";
import type { StatRow } from "../../lib/types";
import { GAME_STEPS, PLAYER_STEPS, PROVIDER_NAMES, tx } from "../core/blueprint";
import { useGameData, usePlayerData } from "../core/data";
import {
  addPlayer, coverage, gameProgress, gateOpen, makePlayer, missingGateSteps,
  patchStep, playerProgress, readStep, removePlayer, stepStatus, type Scope,
} from "../core/session";
import { useSession } from "../core/store";
import type { StepState, WoaSession } from "../core/types";
import StepCard from "../components/StepCard";
import GamePanel from "../panels/GamePanels";
import PlayerPanel from "../panels/PlayerPanels";
import "../woa.css";

type Active =
  | { kind: "game"; stepId: string }
  | { kind: "player"; playerId: string; stepId: string }
  | { kind: "roster" };

const SKILL_POS = ["QB", "RB", "WR", "TE"];

export default function WoaSession() {
  const { id } = useParams();
  const t = useT();
  const navigate = useNavigate();
  const { session, loading, update, flush } = useSession(id);
  const [active, setActive] = useState<Active>({ kind: "game", stepId: "M1" });
  const [query, setQuery] = useState("");

  const game = useGameData(session?.dataSeason ?? 0);
  const playerPhase = active.kind !== "game";
  const playerData = usePlayerData(session?.dataSeason ?? 0, playerPhase);

  const open = session ? gateOpen(session) : false;
  const progress = session ? gameProgress(session) : null;
  const cov = useMemo(() => (session ? coverage(session) : []), [session]);

  if (loading) return <Loading />;
  if (!session) return <ErrorMsg msg={t("woa.session.missing")} />;

  const scope: Scope = active.kind === "player"
    ? { kind: "player", playerId: active.playerId }
    : { kind: "game" };

  const player = active.kind === "player"
    ? session.players.find((p) => p.id === active.playerId)
    : undefined;

  const onPatch = (stepId: string) => (patch: Partial<StepState>) =>
    update((s) => patchStep(s, scope, stepId, patch));

  function goNext() {
    if (!session) return;
    if (active.kind === "game") {
      const i = GAME_STEPS.findIndex((s) => s.id === active.stepId);
      const next = GAME_STEPS[i + 1];
      if (next) setActive({ kind: "game", stepId: next.id });
      else if (gateOpen(session)) setActive({ kind: "roster" });
      return;
    }
    if (active.kind === "player") {
      const i = PLAYER_STEPS.findIndex((s) => s.id === active.stepId);
      const next = PLAYER_STEPS[i + 1];
      setActive(next
        ? { kind: "player", playerId: active.playerId, stepId: next.id }
        : { kind: "roster" });
    }
  }

  async function finish() {
    update((s) => ({ ...s, status: "done", finishedAt: Date.now() }));
    await flush();
    navigate(`/woa/${session!.id}/report`);
  }

  /* ------------------------------------------------------------ kadro */

  const roster = (team: string): StatRow[] =>
    (game.depth ?? [])
      .filter((r) => r.team === team && String(r.formation) === "3WR 1TE"
                  && SKILL_POS.includes(String(r.position)))
      .sort((a, b) => SKILL_POS.indexOf(String(a.position))
                    - SKILL_POS.indexOf(String(b.position))
                    || Number(a.depth) - Number(b.depth));

  const matches = (r: StatRow) =>
    !query || String(r.player_name).toLowerCase().includes(query.toLowerCase());

  function pick(r: StatRow) {
    const playerId = String(r.player_id);
    const existing = session!.players.find((p) => p.playerId === playerId);
    if (existing) {
      setActive({ kind: "player", playerId: existing.id, stepId: "P1" });
      return;
    }
    const entry = makePlayer({
      playerId,
      name: String(r.player_name),
      position: String(r.position),
      team: String(r.team),
    });
    update((s) => addPlayer(s, entry));
    setActive({ kind: "player", playerId: entry.id, stepId: "P1" });
  }

  /* ------------------------------------------------------------ çizim */

  return (
    <section className="woa">
      <header className="woa-top">
        <button className="woa-back" onClick={() => navigate("/woa")}>←</button>
        <h1>
          <TeamLogo abbr={session.away} size={26} /> {session.away}
          <span className="woa-dim"> @ </span>
          <TeamLogo abbr={session.home} size={26} /> {session.home}
        </h1>
        <span className="woa-dim">
          {session.season} · {t("common.weekShort")}{session.week}
        </span>
        <span className="woa-bar-wrap" title={t("woa.progress", {
          filled: progress?.filled ?? 0, total: progress?.total ?? 0 })}>
          <span className="woa-bar-fill"
                style={{ width: `${((progress?.filled ?? 0) / GAME_STEPS.length) * 100}%` }} />
        </span>
        <span className="woa-dim">{progress?.filled}/{progress?.total}</span>
        <button className="pill" onClick={() => void finish()}>{t("woa.finish")}</button>
      </header>

      <div className="woa-grid">
        <nav className="woa-stepper">
          <h3>{t("woa.nav.game")}</h3>
          {GAME_STEPS.map((def) => {
            const status = stepStatus(session.steps[def.id], def);
            const on = active.kind === "game" && active.stepId === def.id;
            return (
              <button key={def.id} className={`woa-stepitem${on ? " is-active" : ""}`}
                      onClick={() => setActive({ kind: "game", stepId: def.id })}>
                <span className={`woa-dot woa-dot--${status}`} />
                <span className="woa-stepitem__id">{def.id}</span>
                <span className="woa-stepitem__title">{tx(def.title)}</span>
                {def.required && <span className="woa-lock">🔒</span>}
              </button>
            );
          })}

          <h3>
            {t("woa.nav.players")}
            {!open && <span className="woa-lock" title={t("woa.gate.locked")}>🔒</span>}
          </h3>
          {!open ? (
            <p className="woa-gate">
              {t("woa.gate.hint", {
                steps: missingGateSteps(session).map((s) => s.id).join(", ") })}
            </p>
          ) : (
            <>
              {session.players.map((p) => {
                const pp = playerProgress(p);
                const on = active.kind === "player" && active.playerId === p.id;
                return (
                  <div key={p.id} className="woa-playerbox">
                    <button className={`woa-stepitem${on ? " is-active" : ""}`}
                            onClick={() => setActive({ kind: "player", playerId: p.id,
                                                       stepId: "P1" })}>
                      <span className="woa-stepitem__title">{p.name}</span>
                      <span className="woa-dim">{p.position}</span>
                      <span className="woa-progress-mini">{pp.filled}/{pp.total}</span>
                    </button>
                    {on && PLAYER_STEPS.map((def) => {
                      const status = stepStatus(p.steps[def.id], def);
                      return (
                        <button key={def.id}
                                className={`woa-stepitem woa-stepitem--sub${
                                  active.stepId === def.id ? " is-active" : ""}`}
                                onClick={() => setActive({ kind: "player", playerId: p.id,
                                                           stepId: def.id })}>
                          <span className={`woa-dot woa-dot--${status}`} />
                          <span className="woa-stepitem__id">{def.id}</span>
                          <span className="woa-stepitem__title">{tx(def.title)}</span>
                        </button>
                      );
                    })}
                    {on && (
                      <button className="woa-del woa-del--inline"
                              onClick={() => {
                                update((s) => removePlayer(s, p.id));
                                setActive({ kind: "roster" });
                              }}>
                        {t("woa.player.remove")}
                      </button>
                    )}
                  </div>
                );
              })}
              <button className={`woa-stepitem woa-add${
                        active.kind === "roster" ? " is-active" : ""}`}
                      onClick={() => setActive({ kind: "roster" })}>
                + {t("woa.player.add")}
              </button>
            </>
          )}
        </nav>

        <div className="woa-main">
          {active.kind === "game" && (() => {
            const def = GAME_STEPS.find((s) => s.id === active.stepId)!;
            const state = readStep(session, scope, def.id);
            return (
              <StepCard def={def} state={state} away={session.away} home={session.home}
                        onPatch={onPatch(def.id)} onNext={goNext}
                        panel={<GamePanel stepId={def.id} session={session}
                                          data={game} state={state} />} />
            );
          })()}

          {active.kind === "player" && player && (() => {
            const def = PLAYER_STEPS.find((s) => s.id === active.stepId)!;
            const state = readStep(session, scope, def.id);
            return (
              <>
                <div className="woa-playerhead">
                  <TeamLogo abbr={player.team} size={22} />
                  <strong>{player.name}</strong>
                  <span className="woa-dim">{player.position} · {player.team}</span>
                </div>
                <StepCard def={def} state={state} away={session.away} home={session.home}
                          position={player.position}
                          onPatch={onPatch(def.id)} onNext={goNext}
                          panel={<PlayerPanel stepId={def.id} session={session}
                                              player={player} game={game}
                                              data={playerData} />} />
              </>
            );
          })()}

          {active.kind === "roster" && (
            <article className="woa-step">
              <header className="woa-step__head">
                <div><h2>{t("woa.player.pick")}</h2></div>
              </header>
              <p className="woa-why">{t("woa.player.pickWhy")}</p>
              <input className="woa-search" value={query} placeholder={t("common.searchPlayer")}
                     onChange={(e) => setQuery(e.target.value)} />
              <div className="woa-two">
                {[session.away, session.home].map((team) => (
                  <div key={team} className="woa-panelbox">
                    <h4><TeamLogo abbr={team} size={18} /> {teamName(team)}</h4>
                    <ul className="woa-roster">
                      {roster(team).filter(matches).map((r, i) => {
                        const added = session.players.some(
                          (p) => p.playerId === String(r.player_id));
                        return (
                          <li key={i}>
                            <button className={added ? "is-added" : ""}
                                    onClick={() => pick(r)}>
                              <span className="woa-dim">{String(r.position)}
                                {String(r.depth)}</span>
                              {String(r.player_name)}
                              {added && <span className="woa-dim"> ✓</span>}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </article>
          )}
        </div>

        <aside className="woa-side">
          <h3>{t("woa.side.title")}</h3>
          <Summary session={session} />
          <h3>{t("woa.side.coverage")}</h3>
          <ul className="woa-cov">
            {cov.map((c) => (
              <li key={c.provider}>
                <span>{PROVIDER_NAMES[c.provider]}</span>
                <strong>{c.used.length}/{c.used.length + c.unused.length}</strong>
              </li>
            ))}
          </ul>
          <button className="pill small" onClick={() => navigate(`/woa/${session.id}/report`)}>
            {t("woa.side.preview")}
          </button>
        </aside>
      </div>
    </section>
  );
}

function Summary({ session }: { session: WoaSession }) {
  const t = useT();
  const lines = GAME_STEPS.map((def) => {
    const st = session.steps[def.id];
    const text = def.notes === "perTeam"
      ? [st?.away, st?.home].filter(Boolean).join(" · ")
      : st?.note ?? "";
    return { def, text: text?.trim() ?? "" };
  }).filter((l) => l.text);

  if (lines.length === 0) return <p className="woa-empty">{t("woa.side.empty")}</p>;
  return (
    <ul className="woa-list woa-recap">
      {lines.map(({ def, text }) => (
        <li key={def.id}>
          <span className="woa-dim">{def.id}</span> {text}
        </li>
      ))}
    </ul>
  );
}
