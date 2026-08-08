/** Grafikler — tek statta sıralama ya da iki statın dağılımı.
 *
 *  Web sürümünde eksen seçimli scatter + bar sıralaması var. Telefonda
 *  dikey bar çubukları isim sığdıramıyor, o yüzden sıralama yatay
 *  çubuklarla; dağılımda ise noktaya dokununca kimin olduğu yazılıyor.
 */
import { useMemo, useState } from "react";
import { View } from "react-native";
import { Stack, useRouter } from "expo-router";
import Screen from "../src/components/Screen";
import { RankBars, ScatterChart } from "../src/components/charts";
import {
  Card, Empty, ErrorBox, Loading, Muted, PillRow, SectionHeader, Title,
} from "../src/components/ui";
import {
  loadManifest, loadPlayerSeason, loadTeamAdvanced, loadTeamSeason,
  seasonsFromManifest,
} from "../src/lib/data";
import { useAsync, useRefresh } from "../src/lib/hooks";
import { label, PERCENT_COLS, POSITION_PRESETS } from "../src/lib/columns";
import { useT } from "../src/lib/i18n";
import { space } from "../src/lib/theme";
import type { StatRow } from "../src/lib/types";

const POS_FILTER: Record<string, (p: StatRow) => boolean> = {
  QB: (p) => p.position === "QB",
  RB: (p) => p.position === "RB" || p.position === "FB",
  WR: (p) => p.position === "WR",
  TE: (p) => p.position === "TE",
  DEF: (p) => !["QB", "RB", "FB", "WR", "TE", "K", "P"].includes(String(p.position ?? "")),
};
const POSITIONS = ["QB", "RB", "WR", "TE", "DEF"];

const DEFAULT_AXES: Record<string, [string, string]> = {
  QB: ["attempts", "passing_yards"],
  RB: ["carries", "rushing_yards"],
  WR: ["target_share", "receiving_yards"],
  TE: ["target_share", "receiving_yards"],
  DEF: ["def_tackles_solo", "def_sacks"],
};

const TEAM_STATS = ["points_for", "points_against", "passing_yards", "rushing_yards",
                    "off_epa_play", "def_epa_play", "off_success_rate",
                    "def_success_rate", "off_explosive_rate"];

/** Yüzde kolonları 0–1 aralığında; grafikte 100'le çarpılmış hâli okunur. */
const scaled = (col: string, v: unknown): number =>
  PERCENT_COLS.has(col) ? Number(v ?? 0) * 100 : Number(v ?? 0);

export default function ChartsPage() {
  const t = useT();
  const router = useRouter();
  const [mode, setMode] = useState<"player" | "team">("player");
  const [view, setView] = useState<"bars" | "scatter">("bars");
  const [season, setSeason] = useState<number | null>(null);
  const [pos, setPos] = useState("WR");
  const [xChoice, setXChoice] = useState<string | null>(null);
  const [yChoice, setYChoice] = useState<string | null>(null);

  const manifestQ = useAsync((o) => loadManifest(o), []);
  const seasons = manifestQ.data ? seasonsFromManifest(manifestQ.data) : [];
  const active = season ?? seasons[0] ?? null;

  const playersQ = useAsync(
    (o) => (active ? loadPlayerSeason(active, o) : Promise.resolve([])), [active]);
  const teamQ = useAsync(
    (o) => (active ? loadTeamSeason(active, o) : Promise.resolve([])), [active]);
  const advQ = useAsync(
    (o) => (active ? loadTeamAdvanced(active, o) : Promise.resolve(null)), [active]);

  const { refreshing, onRefresh } = useRefresh([
    playersQ.reload, teamQ.reload, advQ.reload,
  ]);

  const teamRows = useMemo(() => {
    const adv = new Map((advQ.data ?? []).map((r) => [String(r.team), r]));
    return (teamQ.data ?? []).map((r) => ({ ...r, ...(adv.get(String(r.team)) ?? {}) }));
  }, [teamQ.data, advQ.data]);

  const statChoices = mode === "team"
    ? TEAM_STATS
    : (POSITION_PRESETS[pos] ?? POSITION_PRESETS.WR);

  const [defX, defY] = mode === "team"
    ? ["points_for", "off_epa_play"]
    : (DEFAULT_AXES[pos] ?? DEFAULT_AXES.WR);
  const xCol = xChoice && statChoices.includes(xChoice) ? xChoice : defX;
  const yCol = yChoice && statChoices.includes(yChoice) ? yChoice : defY;

  const rows = useMemo(() => {
    if (mode === "team") return teamRows;
    return (playersQ.data ?? []).filter(POS_FILTER[pos] ?? (() => true));
  }, [mode, teamRows, playersQ.data, pos]);

  const barRows = useMemo(() => [...rows]
    .filter((r) => r[yCol] !== null && r[yCol] !== undefined)
    .sort((a, b) => scaled(yCol, b[yCol]) - scaled(yCol, a[yCol]))
    .slice(0, 15)
    .map((r) => ({
      key: String(r.player_id ?? r.team),
      label: mode === "team" ? String(r.team)
        : `${String(r.player_name).split(" ").slice(-1)[0]} (${r.team})`,
      value: scaled(yCol, r[yCol]),
    })),
    [rows, yCol, mode]);

  const scatterPoints = useMemo(() => rows
    .filter((r) => r[xCol] !== null && r[xCol] !== undefined
      && r[yCol] !== null && r[yCol] !== undefined)
    .map((r) => ({
      key: String(r.player_id ?? r.team),
      label: mode === "team" ? String(r.team) : String(r.player_name),
      x: Number(scaled(xCol, r[xCol]).toFixed(1)),
      y: Number(scaled(yCol, r[yCol]).toFixed(1)),
    }))
    .slice(0, 220),
    [rows, xCol, yCol, mode]);

  const loading = mode === "team" ? teamQ.loading : playersQ.loading;
  const error = mode === "team" ? teamQ.error : playersQ.error;

  return (
    <>
      <Stack.Screen options={{ title: t("charts.title2") }} />
      <Screen refreshing={refreshing} onRefresh={onRefresh}
              freshnessKey={active ? `seasons/${active}/player_season.json` : undefined}>
        <Title sub={t("charts.sub2")}>{t("charts.title2")}</Title>

        <PillRow
          options={[
            { value: "player" as const, label: t("common.player") },
            { value: "team" as const, label: t("common.team") },
          ]}
          value={mode}
          onChange={setMode}
        />
        <PillRow
          options={[
            { value: "bars" as const, label: t("charts.bars") },
            { value: "scatter" as const, label: t("charts.scatter") },
          ]}
          value={view}
          onChange={setView}
          compact
        />
        <PillRow
          options={seasons.map((s) => ({ value: s, label: String(s) }))}
          value={active ?? 0}
          onChange={setSeason}
        />
        {mode === "player" ? (
          <PillRow
            options={POSITIONS.map((p) => ({ value: p, label: p }))}
            value={pos}
            onChange={setPos}
            compact
          />
        ) : null}

        {loading && rows.length === 0 ? <Loading /> : null}
        {error && rows.length === 0 ? (
          <ErrorBox msg={error} onRetry={() => (mode === "team" ? teamQ : playersQ).reload(true)} />
        ) : null}

        <SectionHeader title={t("charts.yAxis")} />
        <PillRow
          options={statChoices.map((s) => ({ value: s, label: label(s) }))}
          value={yCol}
          onChange={setYChoice}
          compact
        />

        {view === "scatter" ? (
          <>
            <SectionHeader title={t("charts.xAxis")} />
            <PillRow
              options={statChoices.map((s) => ({ value: s, label: label(s) }))}
              value={xCol}
              onChange={setXChoice}
              compact
            />
          </>
        ) : null}

        <View style={{ height: space.md }} />

        {view === "bars" ? (
          barRows.length > 0 ? (
            <Card>
              <RankBars
                rows={barRows}
                onPress={(key) => router.push(
                  mode === "team" ? `/team/${key}` : `/player/${key}`)}
              />
              <Muted style={{ marginTop: space.sm }}>
                {label(yCol)}{PERCENT_COLS.has(yCol) ? " (%)" : ""} · {t("m.results", { n: rows.length })}
              </Muted>
            </Card>
          ) : <Empty text={t("table.empty")} />
        ) : (
          scatterPoints.length > 0 ? (
            <Card>
              <ScatterChart
                points={scatterPoints}
                xLabel={label(xCol)}
                yLabel={label(yCol)}
                onSelect={() => {}}
              />
            </Card>
          ) : <Empty text={t("table.empty")} />
        )}
      </Screen>
    </>
  );
}
