/** NCAA oyuncu künyesi — NFL'in sadeleştirilmiş hâli: ESPN box score'da
 *  snap, red zone, NGS ya da sakatlık yok. */
import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import Screen from "../../../src/components/Screen";
import StatTable from "../../../src/components/StatTable";
import NcaaBadge from "../../../src/components/NcaaBadge";
import { WeekBars } from "../../../src/components/charts";
import {
  Card, Empty, Loading, Muted, PillRow, SectionHeader, StatTile, Title,
} from "../../../src/components/ui";
import {
  loadNcaaManifest, loadNcaaPlayerIndex, loadNcaaPlayerSeason, loadNcaaPlayerWeeks,
  loadNcaaProjections, loadNcaaTeams, ncaaOrd, ncaaPreset, teamMapOf,
} from "../../../src/lib/ncaa";
import { seasonsFromManifest } from "../../../src/lib/data";
import { useAsync, useRefresh } from "../../../src/lib/hooks";
import { fmt, label } from "../../../src/lib/columns";
import { useT } from "../../../src/lib/i18n";
import { font, space, useColors } from "../../../src/lib/theme";
import type { StatRow } from "../../../src/lib/types";

export default function NcaaPlayerDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const c = useColors();
  const [season, setSeason] = useState<number | null>(null);
  const [statChoice, setStatChoice] = useState<string | null>(null);

  const manifestQ = useAsync((o) => loadNcaaManifest(o), []);
  const seasons = manifestQ.data ? seasonsFromManifest(manifestQ.data) : [];
  const active = season ?? seasons[0] ?? null;

  const indexQ = useAsync((o) => loadNcaaPlayerIndex(o), []);
  const player = useMemo(
    () => indexQ.data?.find((p) => String(p.player_id) === String(id)) ?? null,
    [indexQ.data, id],
  );

  const teamsQ = useAsync((o) => loadNcaaTeams(o), []);
  const tmap = useMemo(() => teamMapOf(teamsQ.data), [teamsQ.data]);

  const weeksQ = useAsync(async (o) => {
    if (!active) return [];
    const rows = await loadNcaaPlayerWeeks(active, o);
    return rows
      .filter((r) => String(r.player_id) === String(id))
      .sort((a, b) => ncaaOrd(a) - ncaaOrd(b));
  }, [id, active]);

  const seasonRowQ = useAsync(async (o) => {
    if (!active) return null;
    const rows = await loadNcaaPlayerSeason(active, o);
    return rows.find((r) => String(r.player_id) === String(id)) ?? null;
  }, [id, active]);

  const careerQ = useAsync(async (o) => {
    const per = await Promise.all(seasons.map(async (s): Promise<StatRow | null> => {
      try {
        const rows = await loadNcaaPlayerSeason(s, o);
        const row = rows.find((r) => String(r.player_id) === String(id));
        return row ? { ...row, season: s } : null;
      } catch {
        return null;
      }
    }));
    return per.filter((r): r is StatRow => r !== null)
      .sort((a, b) => Number(b.season) - Number(a.season));
  }, [id, seasons.join()]);

  const projQ = useAsync((o) => loadNcaaProjections(o), []);
  const myProj = useMemo(
    () => projQ.data?.rows.find((p) => String(p.player_id) === String(id)) ?? null,
    [projQ.data, id],
  );

  const { refreshing, onRefresh } = useRefresh([
    indexQ.reload, weeksQ.reload, seasonRowQ.reload, careerQ.reload, projQ.reload,
  ]);

  const pos = String(player?.position ?? seasonRowQ.data?.position
                     ?? weeksQ.data?.[0]?.position ?? "");
  const preset = ncaaPreset(pos || null);
  const chartStat = statChoice ?? preset[0];
  const team = String(player?.current_team ?? player?.team ?? seasonRowQ.data?.team ?? "");

  const bars = useMemo(
    () => (weeksQ.data ?? []).map((r) => ({
      label: ncaaOrd(r) >= 100 ? "B" : String(r.week),
      value: Number(r[chartStat] ?? 0),
      highlight: String(r.season_type) === "POST",
    })),
    [weeksQ.data, chartStat],
  );

  if (indexQ.loading && !indexQ.data) return <Screen><Loading /></Screen>;

  const title = String(player?.player_name ?? seasonRowQ.data?.player_name ?? id);

  return (
    <>
      <Stack.Screen options={{ title }} />
      <Screen refreshing={refreshing} onRefresh={onRefresh}
              freshnessKey="ncaa/players/index.json">
        <View style={styles.header}>
          <NcaaBadge abbr={team} size={44} link />
          <View style={{ flex: 1 }}>
            <Title>{title}</Title>
            <Muted style={{ marginTop: -space.sm }}>
              {pos || "?"} · {tmap.get(team)?.school ?? team}
              {player ? ` · ${player.first_season}–${player.last_season}` : ""}
            </Muted>
          </View>
        </View>

        {myProj ? (
          <>
            <SectionHeader
              title={t("ncaa.projUpcoming")}
            />
            <Card>
              <Muted style={{ marginBottom: space.sm }}>
                {String(myProj.team)} {myProj.is_home ? "vs" : "@"} {String(myProj.opponent)}
                {projQ.data ? ` · ${projQ.data.target.season} W${projQ.data.target.week}` : ""}
              </Muted>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                          contentContainerStyle={{ gap: space.sm }}>
                {preset
                  .filter((s) => myProj[`proj_${s}`] !== null
                                 && myProj[`proj_${s}`] !== undefined)
                  .map((s) => (
                    <StatTile key={s} label={label(s)}
                              value={fmt(`proj_${s}`, myProj[`proj_${s}`])} />
                  ))}
              </ScrollView>
            </Card>
          </>
        ) : null}

        <SectionHeader title={t("m.seasonTotals")} />
        <PillRow
          options={seasons.map((s) => ({ value: s, label: String(s) }))}
          value={active ?? 0}
          onChange={setSeason}
        />
        {seasonRowQ.data ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: space.sm, paddingVertical: space.sm }}>
            {["games", ...preset].map((s) => (
              <StatTile key={s} label={label(s)} value={fmt(s, seasonRowQ.data![s])} />
            ))}
          </ScrollView>
        ) : seasonRowQ.loading ? <Loading /> : <Empty text={t("player.noData")} />}

        <SectionHeader title={t("m.gameLog")} />
        <PillRow
          options={preset.map((s) => ({ value: s, label: label(s) }))}
          value={chartStat}
          onChange={setStatChoice}
          compact
        />
        {bars.length > 0 ? (
          <Card style={{ marginTop: space.sm }}>
            <WeekBars data={bars} />
            <Muted style={{ marginTop: space.sm }}>
              {label(chartStat)} · {bars.length} {t("team.games").toLowerCase()}
            </Muted>
          </Card>
        ) : weeksQ.loading ? <Loading /> : <Empty text={t("player.dnp")} />}

        {weeksQ.data && weeksQ.data.length > 0 ? (
          <View style={{ marginTop: space.md }}>
            <StatTable
              rows={weeksQ.data}
              columns={["week", "opponent", ...preset]}
              defaultSort="week"
              firstWidth={64}
            />
          </View>
        ) : null}

        {careerQ.data && careerQ.data.length > 1 ? (
          <>
            <SectionHeader title={t("player.career")} />
            <StatTable
              rows={careerQ.data}
              columns={["season", "team", "games", ...preset]}
              defaultSort="season"
              firstWidth={72}
            />
          </>
        ) : null}

        <Text style={{ color: c.textDim, fontSize: font.xs, marginTop: space.lg }}>
          {t("ncaa.noSecond")}
        </Text>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
});
