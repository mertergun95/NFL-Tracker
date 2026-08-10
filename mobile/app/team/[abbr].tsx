/** Takım sayfası: sezon künyesi, fikstür, kadro istatistikleri ve
 *  "bu savunmaya karşı" oyuncu logları. */
import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import Screen from "../../src/components/Screen";
import StatTable from "../../src/components/StatTable";
import PName from "../../src/components/PName";
import TeamBadge, { TeamCell } from "../../src/components/TeamBadge";
import {
  Card, Empty, Loading, Muted, PillRow, SectionHeader, StatTile, Title,
} from "../../src/components/ui";
import {
  loadManifest, loadPlayerSeason, loadPlayerWeeks, loadSchedule, loadTeamAdvanced,
  loadTeamSeason, seasonsFromManifest,
} from "../../src/lib/data";
import { useAsync, useRefresh } from "../../src/lib/hooks";
import { fmt, label, POSITION_PRESETS } from "../../src/lib/columns";
import { teamName, TEAMS } from "../../src/lib/teams";
import { etLocal } from "../../src/lib/time";
import { weekLabel } from "../../src/lib/schedule";
import { useT } from "../../src/lib/i18n";
import { font, space, useColors } from "../../src/lib/theme";
import type { StatRow } from "../../src/lib/types";

const TABS = ["roster", "schedule", "against", "advanced"] as const;
type Tab = (typeof TABS)[number];

const POS_FILTER: Record<string, (p: StatRow) => boolean> = {
  QB: (p) => p.position === "QB",
  RB: (p) => p.position === "RB" || p.position === "FB",
  WR: (p) => p.position === "WR",
  TE: (p) => p.position === "TE",
  K: (p) => p.position === "K",
  DEF: (p) => !["QB", "RB", "FB", "WR", "TE", "K", "P"].includes(String(p.position ?? "")),
};
const POSITIONS = ["QB", "RB", "WR", "TE", "K", "DEF"];
const SORT: Record<string, string> = {
  QB: "passing_yards", RB: "rushing_yards", WR: "receiving_yards",
  TE: "receiving_yards", K: "fg_made", DEF: "def_sacks",
};

const OFF_COLS = ["off_epa_play", "off_success_rate", "off_pass_epa", "off_rush_epa",
                  "off_explosive_rate", "off_third_down_conv", "off_rz_td_pct"];
const DEF_COLS = ["def_epa_play", "def_success_rate", "def_pass_epa", "def_rush_epa",
                  "def_explosive_rate", "def_third_down_conv", "def_rz_td_pct"];

export default function TeamDetail() {
  const { abbr } = useLocalSearchParams<{ abbr: string }>();
  const t = useT();
  const c = useColors();
  const router = useRouter();
  const [season, setSeason] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>("roster");
  const [pos, setPos] = useState("QB");

  const manifestQ = useAsync((o) => loadManifest(o), []);
  const seasons = manifestQ.data ? seasonsFromManifest(manifestQ.data) : [];
  const active = season ?? seasons[0] ?? null;

  const teamQ = useAsync(async (o) => {
    if (!active) return null;
    const rows = await loadTeamSeason(active, o);
    return rows.find((r) => r.team === abbr) ?? null;
  }, [abbr, active]);

  const rosterQ = useAsync(async (o) => {
    if (!active) return [];
    const rows = await loadPlayerSeason(active, o);
    return rows.filter((r) => r.team === abbr);
  }, [abbr, active]);

  const schedQ = useAsync(async (o) => {
    if (!active) return [];
    const rows = await loadSchedule(active, o);
    return rows.filter((g) => g.home_team === abbr || g.away_team === abbr)
      .sort((a, b) => Number(a.week) - Number(b.week));
  }, [abbr, active]);

  const againstQ = useAsync(async (o) => {
    if (!active || tab !== "against") return [];
    const rows = await loadPlayerWeeks(active, o);
    return rows.filter((p) => p.opponent_team === abbr);
  }, [abbr, active, tab]);

  const advancedQ = useAsync(async (o) => {
    if (!active) return null;
    const rows = await loadTeamAdvanced(active, o);
    return rows?.find((r) => r.team === abbr) ?? null;
  }, [abbr, active]);

  const { refreshing, onRefresh } = useRefresh([
    teamQ.reload, rosterQ.reload, schedQ.reload, againstQ.reload, advancedQ.reload,
  ]);

  const rosterRows = useMemo(
    () => (rosterQ.data ?? []).filter(POS_FILTER[pos]),
    [rosterQ.data, pos],
  );
  const againstRows = useMemo(
    () => (againstQ.data ?? []).filter(POS_FILTER[pos]),
    [againstQ.data, pos],
  );

  if (!abbr || !TEAMS[abbr]) {
    return (
      <>
        <Stack.Screen options={{ title: String(abbr ?? "") }} />
        <Screen><Empty text={t("m.noTeam")} /></Screen>
      </>
    );
  }

  const record = teamQ.data
    ? `${teamQ.data.wins ?? 0}-${teamQ.data.losses ?? 0}` +
      (Number(teamQ.data.ties ?? 0) > 0 ? `-${teamQ.data.ties}` : "")
    : "";

  return (
    <>
      <Stack.Screen options={{ title: abbr }} />
      <Screen refreshing={refreshing} onRefresh={onRefresh}
              freshnessKey={active ? `seasons/${active}/team_season.json` : undefined}>
        <View style={styles.header}>
          <TeamBadge abbr={abbr} size={52} />
          <View style={{ flex: 1 }}>
            <Title>{teamName(abbr)}</Title>
            <Muted style={{ marginTop: -space.sm }}>
              {TEAMS[abbr].division}{record ? ` · ${record}` : ""}
            </Muted>
          </View>
        </View>

        <PillRow
          options={seasons.map((s) => ({ value: s, label: String(s) }))}
          value={active ?? 0}
          onChange={setSeason}
        />

        {teamQ.data ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: space.sm, paddingVertical: space.md }}>
            {["wins", "losses", "points_for", "points_against"].map((s) => (
              <StatTile key={s} label={label(s)} value={fmt(s, teamQ.data![s])} />
            ))}
          </ScrollView>
        ) : null}

        <PillRow
          options={[
            { value: "roster" as Tab, label: t("m.roster") },
            { value: "schedule" as Tab, label: t("m.schedule") },
            { value: "against" as Tab, label: t("tab.against") },
            { value: "advanced" as Tab, label: t("tab.advanced") },
          ]}
          value={tab}
          onChange={setTab}
          compact
        />

        {tab === "roster" ? (
          <View style={{ marginTop: space.md }}>
            <PillRow
              options={POSITIONS.map((p) => ({ value: p, label: p }))}
              value={pos} onChange={setPos} compact
            />
            {rosterQ.loading && !rosterQ.data ? <Loading /> : (
              <View style={{ marginTop: space.sm }}>
                <StatTable
                  rows={rosterRows}
                  columns={["player_name", "games", ...POSITION_PRESETS[pos]]}
                  defaultSort={SORT[pos]}
                  onRowPress={(row) => router.push(`/player/${row.player_id}`)}
                  render={{
                    player_name: (row) => (
                      <PName name={String(row.player_name)}
                             pos={String(row.position ?? "")}
                             id={String(row.player_id)} />
                    ),
                  }}
                />
              </View>
            )}
          </View>
        ) : null}

        {tab === "schedule" ? (
          <View style={{ marginTop: space.md }}>
            {(schedQ.data ?? []).map((g) => {
              const isHome = g.home_team === abbr;
              const opp = String(isHome ? g.away_team : g.home_team);
              const played = g.home_score !== null;
              const own = Number(isHome ? g.home_score : g.away_score);
              const other = Number(isHome ? g.away_score : g.home_score);
              return (
                <Card
                  key={String(g.game_id)}
                  style={{ marginBottom: space.sm }}
                  onPress={() => router.push(`/game/${active}/${g.game_id}`)}
                >
                  <View style={styles.row}>
                    <Text style={{ color: c.textDim, fontSize: font.xs, width: 34 }}>
                      {weekLabel(Number(g.week), g.game_type as string)}
                    </Text>
                    <Text style={{ color: c.textDim, fontSize: font.xs, width: 22 }}>
                      {isHome ? "vs" : "@"}
                    </Text>
                    <TeamCell abbr={opp} size={22} />
                    <View style={{ flex: 1 }} />
                    {played ? (
                      <Text style={{
                        color: own > other ? c.good : own < other ? c.bad : c.textDim,
                        fontSize: font.md, fontWeight: "700",
                      }}>
                        {own > other ? "W" : own < other ? "L" : "T"} {own}–{other}
                      </Text>
                    ) : (
                      <Text style={{ color: c.textDim, fontSize: font.xs }}>
                        {etLocal(g.gameday, g.gametime) ?? String(g.gameday)}
                      </Text>
                    )}
                  </View>
                </Card>
              );
            })}
            {schedQ.data?.length === 0 ? <Empty text={t("common.noGameData")} /> : null}
          </View>
        ) : null}

        {tab === "against" ? (
          <View style={{ marginTop: space.md }}>
            <Muted style={{ marginBottom: space.sm }}>
              {t("team.logsAgainst", { team: teamName(abbr) })}
            </Muted>
            <PillRow
              options={POSITIONS.map((p) => ({ value: p, label: p }))}
              value={pos} onChange={setPos} compact
            />
            {againstQ.loading ? <Loading /> : (
              <View style={{ marginTop: space.sm }}>
                <StatTable
                  rows={againstRows}
                  columns={["player_name", "week", "team", ...POSITION_PRESETS[pos]]}
                  defaultSort={SORT[pos]}
                  onRowPress={(row) => router.push(`/player/${row.player_id}`)}
                  render={{
                    player_name: (row) => (
                      <PName name={String(row.player_name)}
                             pos={String(row.position ?? "")}
                             id={String(row.player_id)} />
                    ),
                    team: (row) => <TeamCell abbr={row.team as string} size={18}
                                             showAbbr={false} />,
                  }}
                />
              </View>
            )}
          </View>
        ) : null}

        {tab === "advanced" ? (
          <View style={{ marginTop: space.md }}>
            {advancedQ.data ? (
              <>
                <SectionHeader title={t("team.offense")} />
                <ScrollView horizontal showsHorizontalScrollIndicator={false}
                            contentContainerStyle={{ gap: space.sm }}>
                  {OFF_COLS.map((s) => (
                    <StatTile key={s} label={label(s)}
                              value={fmt(s, advancedQ.data![s])} />
                  ))}
                </ScrollView>
                <SectionHeader title={t("team.defense")} />
                <ScrollView horizontal showsHorizontalScrollIndicator={false}
                            contentContainerStyle={{ gap: space.sm }}>
                  {DEF_COLS.map((s) => (
                    <StatTile key={s} label={label(s)}
                              value={fmt(s, advancedQ.data![s])} />
                  ))}
                </ScrollView>
              </>
            ) : (
              <Empty text={t("team.noAdvanced")} />
            )}
          </View>
        ) : null}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
});
