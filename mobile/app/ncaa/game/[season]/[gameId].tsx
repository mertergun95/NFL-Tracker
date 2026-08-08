/** NCAA maç detayı: skor, takım karşılaştırması ve iki takımın box score'u. */
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import Screen from "../../../../src/components/Screen";
import StatTable from "../../../../src/components/StatTable";
import PName from "../../../../src/components/PName";
import NcaaBadge from "../../../../src/components/NcaaBadge";
import {
  Card, Empty, Loading, Muted, PillRow, SectionHeader,
} from "../../../../src/components/ui";
import {
  loadNcaaPlayerWeeks, loadNcaaSchedule, loadNcaaTeams, loadNcaaTeamWeeks, teamMapOf,
} from "../../../../src/lib/ncaa";
import { useAsync, useRefresh } from "../../../../src/lib/hooks";
import { fmt, label } from "../../../../src/lib/columns";
import { useT } from "../../../../src/lib/i18n";
import { kickoffLocal } from "../../../../src/lib/time";
import { font, space, useColors } from "../../../../src/lib/theme";

const PLAYER_COLS = [
  "player_name", "completions", "attempts", "passing_yards", "passing_tds",
  "passing_interceptions", "carries", "rushing_yards", "rushing_tds",
  "receptions", "receiving_yards", "receiving_tds",
];

const COMPARE_COLS = [
  "points", "first_downs", "total_yards", "passing_yards", "yards_per_pass",
  "rushing_yards", "rushing_attempts", "yards_per_rush", "third_down_pct",
  "turnovers",
];

/** Saniye -> "31:24" (topa sahip olma süresi). */
function possession(sec: unknown): string {
  const n = Number(sec ?? 0);
  if (!n) return "—";
  return `${Math.floor(n / 60)}:${String(Math.round(n % 60)).padStart(2, "0")}`;
}

export default function NcaaGameDetail() {
  const { season = "", gameId = "" } =
    useLocalSearchParams<{ season: string; gameId: string }>();
  const t = useT();
  const c = useColors();
  const router = useRouter();
  const [side, setSide] = useState<"away" | "home">("away");

  const gameQ = useAsync(async (o) => {
    const rows = await loadNcaaSchedule(season, o);
    return rows.find((g) => String(g.game_id) === String(gameId)) ?? null;
  }, [season, gameId]);

  const game = gameQ.data;
  const home = String(game?.home_team ?? "");
  const away = String(game?.away_team ?? "");

  const teamsQ = useAsync((o) => loadNcaaTeams(o), []);
  const tmap = useMemo(() => teamMapOf(teamsQ.data), [teamsQ.data]);

  const playersQ = useAsync(async (o) => {
    if (!game) return null;
    const rows = await loadNcaaPlayerWeeks(season, o);
    return rows.filter((r) => String(r.game_id) === String(gameId));
  }, [season, gameId, !!game]);

  const teamWeeksQ = useAsync(async (o) => {
    if (!game) return null;
    const rows = await loadNcaaTeamWeeks(season, o);
    return rows.filter((r) => String(r.game_id) === String(gameId));
  }, [season, gameId, !!game]);

  const { refreshing, onRefresh } = useRefresh([
    gameQ.reload, playersQ.reload, teamWeeksQ.reload,
  ]);

  const compare = useMemo(() => {
    if (!teamWeeksQ.data) return [];
    const h = teamWeeksQ.data.find((r) => r.team === home);
    const a = teamWeeksQ.data.find((r) => r.team === away);
    if (!h || !a) return [];
    return COMPARE_COLS
      .filter((col) => h[col] !== undefined || a[col] !== undefined)
      .map((col) => ({ col, stat: label(col), away: a[col], home: h[col] }))
      .concat([{
        col: "possession_sec",
        stat: t("ncaa.possession"),
        away: possession(a.possession_sec) as unknown as number,
        home: possession(h.possession_sec) as unknown as number,
      }]);
  }, [teamWeeksQ.data, home, away, t]);

  const sideRows = useMemo(() => {
    const team = side === "home" ? home : away;
    return (playersQ.data ?? []).filter((r) => r.team === team);
  }, [playersQ.data, side, home, away]);

  if (gameQ.loading && !game) return <Screen><Loading /></Screen>;
  if (!game)
    return (
      <>
        <Stack.Screen options={{ title: "" }} />
        <Screen><Empty text={t("m.noGame")} /></Screen>
      </>
    );

  const played = game.home_score !== null;
  const a = Number(game.away_score), h = Number(game.home_score);

  return (
    <>
      <Stack.Screen options={{ title: `${away} @ ${home}` }} />
      <Screen refreshing={refreshing} onRefresh={onRefresh}
              freshnessKey={`ncaa/seasons/${season}/schedule.json`}>
        <Muted>
          {String(game.gameday)}
          {kickoffLocal(game.kickoff) ? ` · ${kickoffLocal(game.kickoff)}` : ""}
          {game.neutral_site ? t("game.neutral") : ""}
          {game.conference_game ? t("game.conference") : ""}
        </Muted>
        {game.name ? <Muted style={{ marginTop: 2 }}>{String(game.name)}</Muted> : null}

        <Card style={{ marginTop: space.md }}>
          <View style={styles.hero}>
            <View style={styles.heroSide}>
              <NcaaBadge abbr={away} size={44} link />
              <Text numberOfLines={2} style={[styles.heroName, { color: c.text }]}>
                {tmap.get(away)?.school ?? away}
              </Text>
              <Text style={{ color: played && a > h ? c.good : c.text,
                             fontSize: font.display, fontWeight: "800" }}>
                {played ? a : "—"}
              </Text>
            </View>
            <Text style={{ color: c.textDim, fontSize: font.md }}>@</Text>
            <View style={styles.heroSide}>
              <NcaaBadge abbr={home} size={44} link />
              <Text numberOfLines={2} style={[styles.heroName, { color: c.text }]}>
                {tmap.get(home)?.school ?? home}
              </Text>
              <Text style={{ color: played && h > a ? c.good : c.text,
                             fontSize: font.display, fontWeight: "800" }}>
                {played ? h : "—"}
              </Text>
            </View>
          </View>
          <Muted style={{ textAlign: "center", marginTop: space.sm }}>
            {played ? t("m.final") : t("m.scheduled")}
          </Muted>
        </Card>

        {!played ? <Empty text={t("game.notPlayed")} /> : null}

        {played && compare.length > 0 ? (
          <>
            <SectionHeader title={t("game.teamCompare")} />
            <Card>
              <View style={[styles.compareRow, { borderBottomColor: c.border,
                                                 paddingBottom: space.sm }]}>
                <Text style={[styles.compareVal, { color: c.textDim,
                                                   fontWeight: "700" }]}>{away}</Text>
                <Text style={[styles.compareStat, { color: c.textDim }]} />
                <Text style={[styles.compareVal, { color: c.textDim, textAlign: "right",
                                                   fontWeight: "700" }]}>{home}</Text>
              </View>
              {compare.map((r) => (
                <View key={r.col} style={[styles.compareRow,
                                          { borderBottomColor: c.border }]}>
                  <Text style={[styles.compareVal, { color: c.text }]}>
                    {typeof r.away === "string" ? r.away : fmt(r.col, r.away ?? null)}
                  </Text>
                  <Text numberOfLines={1} style={[styles.compareStat, { color: c.textDim }]}>
                    {r.stat}
                  </Text>
                  <Text style={[styles.compareVal, { color: c.text, textAlign: "right" }]}>
                    {typeof r.home === "string" ? r.home : fmt(r.col, r.home ?? null)}
                  </Text>
                </View>
              ))}
            </Card>
          </>
        ) : null}

        {played ? (
          <>
            <SectionHeader title={t("m.boxscore")} />
            <PillRow
              options={[
                { value: "away" as const, label: `${away} (${t("common.away")})` },
                { value: "home" as const, label: `${home} (${t("common.home")})` },
              ]}
              value={side}
              onChange={setSide}
              compact
            />
            {playersQ.loading && !playersQ.data ? <Loading /> : (
              <View style={{ marginTop: space.sm }}>
                <StatTable
                  rows={sideRows}
                  columns={PLAYER_COLS}
                  defaultSort="passing_yards"
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
          </>
        ) : null}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: "row", alignItems: "center", gap: space.md },
  heroSide: { flex: 1, alignItems: "center", gap: space.xs },
  heroName: { fontSize: font.sm, textAlign: "center", fontWeight: "600" },
  compareRow: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  compareVal: { width: 62, fontSize: font.sm, fontWeight: "600" },
  compareStat: { flex: 1, fontSize: font.xs, textAlign: "center" },
});
