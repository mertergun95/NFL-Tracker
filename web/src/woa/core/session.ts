/** Oturum durumu üzerindeki saf yardımcılar: ilerleme, kilit ve mutasyon.
 *  Bileşenler bunları çağırır, kalıcılık `useSession` tarafında olur. */
import { GAME_STEPS, PLAYER_STEPS, sourcesFor, stepById, toolsInBlueprint,
         TOOLS, type Provider, type StepDef } from "./blueprint";
import type { PlayerEntry, StepState, StepStatus, WoaSession } from "./types";

export function newId(prefix = ""): string {
  const time = Date.now().toString(36);
  const rand = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().replace(/-/g, "").slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  return `${prefix}${time}${rand}`;
}

export interface NewSessionInput {
  season: number; week: number; gameId: string;
  away: string; home: string; gameday?: string; gametime?: string;
  dataSeason: number;
}

export function createSession(input: NewSessionInput): WoaSession {
  const now = Date.now();
  return {
    id: newId("woa_"),
    createdAt: now,
    updatedAt: now,
    status: "active",
    steps: {},
    players: [],
    ...input,
  };
}

/* ------------------------------------------------------------- durum */

const hasText = (v?: string) => !!v && v.trim().length > 0;

/** Bir adım dolu sayılır: not yazılmış ya da yapısal bir alan doldurulmuş.
 *  Yalnız kutu işaretlemek yetmez — kaynağa bakıp hiçbir şey yazmamak,
 *  raporda iz bırakmayan bir adımdır. */
export function stepStatus(state: StepState | undefined, def: StepDef): StepStatus {
  if (!state) return "empty";
  if (state.skipped) return "skipped";
  const notes = def.notes === "perTeam"
    ? hasText(state.away) || hasText(state.home)
    : hasText(state.note);
  const values = Object.values(state.values ?? {}).some(hasText);
  return notes || values ? "filled" : "empty";
}

export function gameProgress(session: WoaSession) {
  let filled = 0, skipped = 0;
  for (const def of GAME_STEPS) {
    const st = stepStatus(session.steps[def.id], def);
    if (st === "filled") filled++;
    else if (st === "skipped") skipped++;
  }
  return { filled, skipped, total: GAME_STEPS.length };
}

export function playerProgress(player: PlayerEntry) {
  let filled = 0;
  for (const def of PLAYER_STEPS)
    if (stepStatus(player.steps[def.id], def) === "filled") filled++;
  return { filled, total: PLAYER_STEPS.length };
}

/** Kilit adımların hepsi doldurulmadan oyuncu analizi açılmaz. */
export function gateOpen(session: WoaSession): boolean {
  return GAME_STEPS.filter((s) => s.required)
    .every((s) => stepStatus(session.steps[s.id], s) === "filled");
}

export function missingGateSteps(session: WoaSession): StepDef[] {
  return GAME_STEPS.filter(
    (s) => s.required && stepStatus(session.steps[s.id], s) !== "filled");
}

/* ---------------------------------------------------------- mutasyon */

export type Scope = { kind: "game" } | { kind: "player"; playerId: string };

function withStep(steps: Record<string, StepState>, stepId: string,
                  patch: Partial<StepState>): Record<string, StepState> {
  return { ...steps, [stepId]: { ...steps[stepId], ...patch } };
}

/** Adım alanlarını günceller; oyuncu kapsamında ilgili oyuncuyu değiştirir. */
export function patchStep(session: WoaSession, scope: Scope, stepId: string,
                          patch: Partial<StepState>): WoaSession {
  if (scope.kind === "game")
    return { ...session, steps: withStep(session.steps, stepId, patch) };
  return {
    ...session,
    players: session.players.map((p) =>
      p.id === scope.playerId
        ? { ...p, steps: withStep(p.steps, stepId, patch) }
        : p),
  };
}

export function readStep(session: WoaSession, scope: Scope,
                         stepId: string): StepState | undefined {
  if (scope.kind === "game") return session.steps[stepId];
  return session.players.find((p) => p.id === scope.playerId)?.steps[stepId];
}

export function setCheck(state: StepState | undefined, tool: string,
                         on: boolean): Partial<StepState> {
  return { checks: { ...(state?.checks ?? {}), [tool]: on } };
}

export function setValue(state: StepState | undefined, key: string,
                         value: string): Partial<StepState> {
  return { values: { ...(state?.values ?? {}), [key]: value } };
}

/** Kadro seçiminden oturum kaydına: id burada üretilir ki çağıran, state
 *  güncellemesini beklemeden yeni oyuncunun kartına geçebilsin. */
export function makePlayer(p: Omit<PlayerEntry, "id" | "steps" | "addedAt">): PlayerEntry {
  return { ...p, id: newId("p_"), steps: {}, addedAt: Date.now() };
}

export function addPlayer(session: WoaSession, entry: PlayerEntry): WoaSession {
  if (session.players.some((x) => x.playerId === entry.playerId)) return session;
  return { ...session, players: [...session.players, entry] };
}

export function removePlayer(session: WoaSession, id: string): WoaSession {
  return { ...session, players: session.players.filter((p) => p.id !== id) };
}

/* -------------------------------------------------- abonelik kapsaması */

export interface Coverage {
  provider: Provider;
  used: string[];
  unused: string[];
}

/** Oturumda hangi dış araçların gerçekten kullanıldığı. Payda, şablonda geçen
 *  araçlar; pay, kutusu işaretlenenler. Amaç: ödenen aboneliğin kullanılmadığı
 *  analizlerin raporda görünmesi. */
export function coverage(session: WoaSession): Coverage[] {
  const checked = new Set<string>();
  const collect = (steps: Record<string, StepState>, position?: string) => {
    for (const [stepId, state] of Object.entries(steps)) {
      const def = stepById(stepId);
      if (!def) continue;
      const visible = new Set(sourcesFor(def, position).map((s) => s.tool));
      for (const [tool, on] of Object.entries(state.checks ?? {}))
        if (on && visible.has(tool)) checked.add(tool);
    }
  };
  collect(session.steps);
  for (const p of session.players) collect(p.steps, p.position);

  const byProvider = new Map<Provider, { used: string[]; unused: string[] }>();
  for (const tool of toolsInBlueprint()) {
    const def = TOOLS[tool];
    if (!def) continue;
    const bucket = byProvider.get(def.provider)
      ?? { used: [], unused: [] };
    (checked.has(tool) ? bucket.used : bucket.unused).push(def.name);
    byProvider.set(def.provider, bucket);
  }
  return [...byProvider.entries()].map(([provider, b]) => ({ provider, ...b }));
}
