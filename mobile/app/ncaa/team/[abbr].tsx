/** NCAA takım sayfası: sezon künyesi, fikstür ve kadro istatistikleri. */
import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import Screen from "../../../src/components/Screen";
import StatTable from "../../../src/components/StatTable";
import PName from "../../../src/components/PName";
import NcaaBadge, { NcaaTeamCell } from "../../../src/components/NcaaBadge";
import {
  Card, Empty, Loading, Muted, PillRow, StatTile, Title,
} from "../../../src/components/ui";
import {
  loadNcaaManifest, loadNcaaPlayerSeason, loadNcaaSchedule, loadNcaaTeams,
  loadNcaaTeamSeason, NCAA_POSITIONS, ncaaOrd, ncaaPreset, teamMapOf,
} from "../../../src/lib/ncaa";
import { seasonsFromManifest } from "../../../src/lib/data";
import { useAsync, useRefresh } from "../../../src/lib/hooks";
import { fmt, label } from "../../../src/lib/columns";
import { useT } from "../../../src/lib/i18n";
import { kickoffLocal } from "../../../src/lib/time";
import { font, space, useColors } from "../../../src/lib/theme";

const TILES = ["points_pg", "points_allowed_pg", "total_yards_pg",
               "passing_yards_pg", "rushing_yards_pg", "turnovers_pg"];
const SORT: Record<string, string> = {
  QB: "passing_yards", RB: "rushing_yards", WR: "receiving_yards",
};

export default function NcaaTeamDetail() {
  const { abbr } = useLocalSearchParams<{ abbr: string }>();
  const t = useT();
  const c = useColors();
  const router = useRouter();
  const [season, setSeason] = useState<number | null>(null);
  const [tab, setTab] = useState<"roster" | "schedule">("roster");
  const [pos, setPos] = useState("QB");

  const manifestQ = useAsync((o) => loadNcaaManifest(o), []);
  const seasons = manifestQ.data ? seasonsFromManifest(manifestQ.data) : [];
  const active = season ?? seasons[0] ?? null;

  const teamsQ = useAsync((o) => loadNcaaTeams(o), []);
  const info = useMemo(
    () => teamMapOf(teamsQ.data).get(String(abbr)) ?? null,
    [teamsQ.data, abbr],
  );

  const teamSeasonQ = useAsync(async (o) => {
    if (!active) return null;
    const rows = await loadNcaaTeamSeason(active, o);
    return rows.find((r) => r.team === abbr) ?? null;
  }, [abbr, active]);

  const rosterQ = useAsync(async (o) => {
    if (!active) return [];
    const rows = await loadNcaaPlayerSeason(active, o);
    return rows.filter((r) => r.team === abbr);
  }, [abbr, active]);

  const schedQ = useAsync(async (o) => {
    if (!active) return [];
    const rows = await loadNcaaSchedule(active, o);
    return rows
      .filter((g) => g.home_team === abbr || g.away_team === abbr)
      .sort((a, b) => ncaaOrd(a) - ncaaOrd(b));
  }, [abbr, active]);

  const { refreshing, onRefresh } = useRefresh([
    teamSeasonQ.reload, rosterQ.reload, schedQ.reload, teamsQ.reload,
  ]);

  const rosterRows = useMemo(
    () => (rosterQ.data ?? []).filter((p) => p.position === pos),
    [rosterQ.data, pos],
  );

  const record = teamSeasonQ.data
    ? `${teamSeasonQ.data.wins ?? 0}-${teamSeasonQ.data.losses ?? 0}`
    : "";

  return (
    <>
      <Stack.Screen options={{ title: String(abbr ?? "") }} />
      <Screen refreshing={refreshing} onRefresh={onRefresh}
              freshnessKey={active ? `ncaa/seasons/${active}/team_season.json` : undefined}>
        <View style={styles.header}>
          <NcaaBadge abbr={String(abbr)} size={52} />
          <View style={{ flex: 1 }}>
            <Title>{info?.school ?? String(abbr)}</Title>
            <Muted style={{ marginTop: -space.sm }}>
              {info?.name ?? ""}
              {info?.conference ? ` · ${info.conference}` : ""}
              {record ? ` · ${record}` : ""}
            </Muted>
          </View>
        </View>

        <PillRow
          options={seasons.map((s) => ({ value: s, label: String(s) }))}
          value={active ?? 0}
          onChange={setSeason}
        />

        {teamSeasonQ.data ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: space.sm, paddingVertical: space.md }}>
            {TILES.map((s) => (
              <StatTile key={s} label={label(s)} value={fmt(s, teamSeasonQ.data![s])} />
            ))}
          </ScrollView>
        ) : teamSeasonQ.loading ? <Loading /> : <Empty text={t("m.noTeam")} />}

        <PillRow
          options={[
            { value: "roster" as const, label: t("m.roster") },
            { value: "schedule" as const, label: t("m.schedule") },
          ]}
          value={tab}
          onChange={setTab}
          compact
        />

        {tab === "roster" ? (
          <View style={{ marginTop: space.md }}>
            <PillRow
              options={NCAA_POSITIONS.map((p) => ({ value: p, label: p }))}
              value={pos} onChange={setPos} compact
            />
            {rosterQ.loading && !rosterQ.data ? <Loading /> : (
              <View style={{ marginTop: space.sm }}>
                <StatTable
                  rows={rosterRows}
                  columns={["player_name", "games", ...ncaaPreset(pos)]}
                  defaultSort={SORT[pos]}
                  onRowPress={(row) => router.push(`/ncaa/player/${row.player_id}`)}
                  render={{
                    player_name: (row) => (
                      <PName name={String(row.player_name)}
                             pos={String(row.position ?? "")} />
                    ),
                  }}
                />
              </View>
            )}
          </View>
        ) : (
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
                  onPress={() => router.push(`/ncaa/game/${active}/${g.game_id}`)}
                >
                  <View style={styles.row}>
                    <Text style={{ color: c.textDim, fontSize: font.xs, width: 30 }}>
                      {ncaaOrd(g) >= 100 ? "B" : String(g.week)}
                    </Text>
                    <Text style={{ color: c.textDim, fontSize: font.xs, width: 22 }}>
                      {isHome ? "vs" : "@"}
                    </Text>
                    <NcaaTeamCell abbr={opp} size={22} />
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
                        {kickoffLocal(g.kickoff) ?? String(g.gameday)}
                      </Text>
                    )}
                  </View>
                </Card>
              );
            })}
            {schedQ.data?.length === 0 ? <Empty text={t("common.noGameData")} /> : null}
          </View>
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
});
