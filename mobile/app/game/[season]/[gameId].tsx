/** Maç detayı: skor, takım karşılaştırması ve iki takımın oyuncu satırları. */
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import Screen from "../../../src/components/Screen";
import StatTable from "../../../src/components/StatTable";
import PName from "../../../src/components/PName";
import TeamBadge from "../../../src/components/TeamBadge";
import {
  Card, Empty, Loading, Muted, PillRow, SectionHeader,
} from "../../../src/components/ui";
import {
  loadPlayerWeeks, loadSchedule, loadTeamWeeks,
} from "../../../src/lib/data";
import { useAsync, useRefresh } from "../../../src/lib/hooks";
import { fmt, label } from "../../../src/lib/columns";
import { teamName } from "../../../src/lib/teams";
import { etLocal } from "../../../src/lib/time";
import { weekLabel } from "../../../src/lib/schedule";
import { useT } from "../../../src/lib/i18n";
import { font, space, useColors } from "../../../src/lib/theme";

const PLAYER_COLS = [
  "player_name", "completions", "attempts", "passing_yards", "passing_tds",
  "passing_interceptions", "carries", "rushing_yards", "rushing_tds",
  "targets", "receptions", "receiving_yards", "receiving_tds",
  "fantasy_points_ppr",
];

const COMPARE_COLS = [
  "completions", "attempts", "passing_yards", "passing_tds",
  "passing_interceptions", "sacks_suffered", "carries", "rushing_yards",
  "rushing_tds", "receptions", "targets", "def_sacks", "def_interceptions",
];

export default function GameDetail() {
  const { season = "", gameId = "" } =
    useLocalSearchParams<{ season: string; gameId: string }>();
  const t = useT();
  const c = useColors();
  const router = useRouter();
  const [side, setSide] = useState<"away" | "home">("away");

  const gameQ = useAsync(async (o) => {
    const rows = await loadSchedule(season, o);
    return rows.find((g) => g.game_id === gameId) ?? null;
  }, [season, gameId]);

  const game = gameQ.data;
  const week = game ? Number(game.week) : null;
  const type = game ? (game.game_type === "REG" ? "REG" : "POST") : null;
  const home = String(game?.home_team ?? "");
  const away = String(game?.away_team ?? "");

  const playersQ = useAsync(async (o) => {
    if (week === null) return null;
    const rows = await loadPlayerWeeks(season, o);
    return rows.filter((r) => Number(r.week) === week && r.season_type === type
      && (r.team === home || r.team === away));
  }, [season, week, home, away]);

  const teamWeeksQ = useAsync(async (o) => {
    if (week === null) return null;
    const rows = await loadTeamWeeks(season, o);
    return rows.filter((r) => Number(r.week) === week && r.season_type === type
      && (r.team === home || r.team === away));
  }, [season, week, home, away]);

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
      .map((col) => ({ col, stat: label(col), away: a[col], home: h[col] }));
  }, [teamWeeksQ.data, home, away]);

  const sideRows = useMemo(() => {
    const team = side === "home" ? home : away;
    return (playersQ.data ?? [])
      .filter((r) => r.team === team && Number(r.fantasy_points_ppr ?? 0) !== 0);
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
  const kick = etLocal(game.gameday, game.gametime);

  return (
    <>
      <Stack.Screen options={{ title: `${away} @ ${home}` }} />
      <Screen refreshing={refreshing} onRefresh={onRefresh}
              freshnessKey={`seasons/${season}/schedule.json`}>
        <Muted>
          {String(game.gameday)} · {weekLabel(Number(game.week), game.game_type as string)}
          {kick ? ` · ${kick}` : ""}
          {game.stadium ? ` · ${game.stadium}` : ""}
        </Muted>

        <Card style={{ marginTop: space.md }}>
          <View style={styles.hero}>
            <View style={styles.heroSide}>
              <TeamBadge abbr={away} size={46} link />
              <Text numberOfLines={2} style={[styles.heroName, { color: c.text }]}>
                {teamName(away)}
              </Text>
              <Text style={{ color: played && a > h ? c.good : c.text,
                             fontSize: font.display, fontWeight: "800" }}>
                {played ? a : "—"}
              </Text>
            </View>
            <Text style={{ color: c.textDim, fontSize: font.md }}>@</Text>
            <View style={styles.heroSide}>
              <TeamBadge abbr={home} size={46} link />
              <Text numberOfLines={2} style={[styles.heroName, { color: c.text }]}>
                {teamName(home)}
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
                    {fmt(r.col, r.away ?? null)}
                  </Text>
                  <Text numberOfLines={1} style={[styles.compareStat, { color: c.textDim }]}>
                    {r.stat}
                  </Text>
                  <Text style={[styles.compareVal, { color: c.text, textAlign: "right" }]}>
                    {fmt(r.col, r.home ?? null)}
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
                  defaultSort="fantasy_points_ppr"
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
