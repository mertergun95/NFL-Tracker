/** Adım panellerinin beslendiği StatGrade verisi.
 *
 *  Maç fazında lazım olanlar oturum açılırken bir kez yüklenir; oyuncu fazının
 *  ağır dosyaları (haftalık satırlar, NGS) yalnız o faza geçildiğinde istenir.
 */
import { useAsync } from "../../lib/hooks";
import {
  loadInjuries, loadNgs, loadOptional, loadPlayerWeeks, loadPower, loadRedzone,
  loadSchedule, loadSnapCounts, loadSos, loadTeamAdvanced, loadTeamScheme,
  loadPlayerScheme, loadProjections,
} from "../../lib/data";
import type { StatRow } from "../../lib/types";

export interface GameData {
  advanced: StatRow[] | null;
  scheme: StatRow[] | null;
  power: StatRow[] | null;
  sos: StatRow[] | null;
  allowed: StatRow[] | null;
  injuries: StatRow[] | null;
  depth: StatRow[] | null;
  schedule: StatRow[] | null;
  next: StatRow[] | null;
  loading: boolean;
}

export function useGameData(dataSeason: number): GameData {
  const { data: advanced } = useAsync(() => loadTeamAdvanced(dataSeason), [dataSeason]);
  const { data: scheme } = useAsync(() => loadTeamScheme(dataSeason), [dataSeason]);
  const { data: power } = useAsync(() => loadPower(), []);
  const { data: sos } = useAsync(() => loadSos(), []);
  const { data: allowed } = useAsync(() => loadOptional("pos_allowed.json"), []);
  const { data: injuries } = useAsync(() => loadInjuries(), []);
  const { data: depth } = useAsync(() => loadOptional("depth_charts.json"), []);
  const { data: next } = useAsync(() => loadOptional("next_schedule.json"), []);
  const { data: schedule, loading } = useAsync(
    () => loadSchedule(dataSeason), [dataSeason]);
  return { advanced, scheme, power, sos, allowed, injuries, depth, schedule, next,
           loading };
}

export interface PlayerData {
  weeks: StatRow[] | null;
  snaps: StatRow[] | null;
  redzone: StatRow[] | null;
  ngsPass: StatRow[] | null;
  ngsRush: StatRow[] | null;
  ngsRec: StatRow[] | null;
  playerScheme: StatRow[] | null;
  projections: StatRow[] | null;
  projTarget: { season: number; week: number } | null;
  loading: boolean;
}

export function usePlayerData(dataSeason: number, enabled: boolean): PlayerData {
  const on = <T,>(fn: () => Promise<T | null>) =>
    (): Promise<T | null> => (enabled ? fn() : Promise.resolve(null));

  const { data: weeks, loading } = useAsync(
    on(() => loadPlayerWeeks(dataSeason)), [dataSeason, enabled]);
  const { data: snaps } = useAsync(on(() => loadSnapCounts(dataSeason)), [dataSeason, enabled]);
  const { data: redzone } = useAsync(on(() => loadRedzone(dataSeason)), [dataSeason, enabled]);
  const { data: ngsPass } = useAsync(
    on(() => loadNgs(dataSeason, "passing")), [dataSeason, enabled]);
  const { data: ngsRush } = useAsync(
    on(() => loadNgs(dataSeason, "rushing")), [dataSeason, enabled]);
  const { data: ngsRec } = useAsync(
    on(() => loadNgs(dataSeason, "receiving")), [dataSeason, enabled]);
  const { data: playerScheme } = useAsync(
    on(() => loadPlayerScheme(dataSeason)), [dataSeason, enabled]);
  const { data: proj } = useAsync(
    on(() => loadProjections()), [enabled]);

  return {
    weeks, snaps, redzone, ngsPass, ngsRush, ngsRec, playerScheme,
    projections: proj?.rows ?? null,
    projTarget: proj?.target ?? null,
    loading: enabled && loading,
  };
}

/* ------------------------------------------------------- küçük yardımcılar */

export const rowFor = (rows: StatRow[] | null, team: string): StatRow | null =>
  rows?.find((r) => r.team === team) ?? null;

/** Bir kolonda takımın ligdeki sırası. highGood=false ise küçük değer iyidir. */
export function rankIn(rows: StatRow[] | null, team: string, col: string,
                       highGood: boolean): number {
  if (!rows) return 0;
  const sorted = rows
    .filter((r) => typeof r[col] === "number")
    .sort((a, b) => highGood
      ? Number(b[col]) - Number(a[col])
      : Number(a[col]) - Number(b[col]));
  return sorted.findIndex((r) => r.team === team) + 1;
}
