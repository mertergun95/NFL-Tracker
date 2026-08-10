/** Oyuncu künyesi.
 *
 *  Web'deki PlayerDetail'in telefona uyarlanmış hâli: grafikler SVG,
 *  geniş tablolar yana kaydırmalı. Bölümler
 *  telefonda okunma sırasına göre: bu haftanın projeksiyonu → sezon
 *  toplamı → maç maç → red zone / snap → kariyer.
 */
import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import Screen from "../../src/components/Screen";
import StatTable from "../../src/components/StatTable";
import TeamBadge from "../../src/components/TeamBadge";
import PlayerAvatar from "../../src/components/PlayerAvatar";
import { RangeBar, WeekBars } from "../../src/components/charts";
import {
  Card, Empty, Loading, Muted, PillRow, SectionHeader, StatTile, StatusBadge, Title,
} from "../../src/components/ui";
import {
  loadInjuries, loadManifest, loadPlayerIndex, loadPlayerSeason, loadPlayerWeeks,
  loadProjections, loadRedzone, loadSnapCounts, seasonsFromManifest,
} from "../../src/lib/data";
import { useAsync, useRefresh } from "../../src/lib/hooks";
import { fmt, label, presetForPosition } from "../../src/lib/columns";
import { projStatsOf, rangeOf } from "../../src/lib/projText";
import { weekLabel } from "../../src/lib/schedule";
import { teamName } from "../../src/lib/teams";
import { useT } from "../../src/lib/i18n";
import { font, space, useColors } from "../../src/lib/theme";
import type { StatRow } from "../../src/lib/types";

const RZ_COLS: Record<string, string[]> = {
  QB: ["rz_pass_att", "rz_pass_tds", "rz_pass_ints", "rz_carries", "rz_rush_tds"],
  RB: ["rz_carries", "rz_rush_tds", "rz_targets", "rz_receptions", "rz_rec_tds"],
  REC: ["rz_targets", "rz_receptions", "rz_rec_tds"],
};

export default function PlayerDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const c = useColors();
  const [season, setSeason] = useState<number | null>(null);
  const [statChoice, setStatChoice] = useState<string | null>(null);

  const manifestQ = useAsync((o) => loadManifest(o), []);
  const seasons = manifestQ.data ? seasonsFromManifest(manifestQ.data) : [];
  const active = season ?? seasons[0] ?? null;

  const indexQ = useAsync((o) => loadPlayerIndex(o), []);
  const player = useMemo(
    () => indexQ.data?.find((p) => p.player_id === id) ?? null,
    [indexQ.data, id],
  );

  const weeksQ = useAsync(async (o) => {
    if (!active) return [];
    const rows = await loadPlayerWeeks(active, o);
    return rows.filter((r) => r.player_id === id)
      .sort((a, b) => Number(a.week) - Number(b.week));
  }, [id, active]);

  const seasonRowQ = useAsync(async (o) => {
    if (!active) return null;
    const rows = await loadPlayerSeason(active, o);
    return rows.find((r) => r.player_id === id) ?? null;
  }, [id, active]);

  const careerQ = useAsync(async (o) => {
    const per = await Promise.all(
      seasons.map(async (s): Promise<StatRow | null> => {
        try {
          const rows = await loadPlayerSeason(s, o);
          const row = rows.find((r) => r.player_id === id);
          return row ? { ...row, season: s } : null;
        } catch {
          return null;
        }
      }),
    );
    return per.filter((r): r is StatRow => r !== null)
      .sort((a, b) => Number(b.season) - Number(a.season));
  }, [id, seasons.join()]);

  const projQ = useAsync((o) => loadProjections(o), []);
  const myProj = useMemo(
    () => projQ.data?.rows.find((p) => p.player_id === id) ?? null,
    [projQ.data, id],
  );

  const injuryQ = useAsync(async (o) => {
    const rows = await loadInjuries(o);
    if (!rows) return null;
    const mine = rows.filter((r) => r.player_id === id)
      .sort((a, b) => Number(b.week ?? 0) - Number(a.week ?? 0));
    return mine[0] ?? null;
  }, [id]);

  const rzQ = useAsync(async (o) => {
    if (!active) return null;
    const rows = await loadRedzone(active, o);
    return rows?.find((r) => r.player_id === id) ?? null;
  }, [id, active]);

  const snapsQ = useAsync(async (o) => {
    if (!active) return null;
    const rows = await loadSnapCounts(active, o);
    if (!rows) return null;
    return rows.filter((r) => r.player_id === id)
      .sort((a, b) => Number(a.week) - Number(b.week));
  }, [id, active]);

  const { refreshing, onRefresh } = useRefresh([
    indexQ.reload, weeksQ.reload, seasonRowQ.reload, careerQ.reload,
    projQ.reload, injuryQ.reload, rzQ.reload, snapsQ.reload,
  ]);

  const pos = String(player?.position ?? weeksQ.data?.[0]?.position ?? "");
  const preset = presetForPosition(pos || null);
  const chartStat = statChoice ?? preset[0];

  const regWeeks = useMemo(
    () => (weeksQ.data ?? []).filter((r) => r.season_type === "REG"),
    [weeksQ.data],
  );

  const bars = useMemo(
    () => (weeksQ.data ?? []).map((r) => ({
      label: weekLabel(Number(r.week), r.game_type as string),
      value: Number(r[chartStat] ?? 0),
      highlight: r.season_type !== "REG",
    })),
    [weeksQ.data, chartStat],
  );

  const average = useMemo(() => {
    if (regWeeks.length === 0) return null;
    const sum = regWeeks.reduce((s, r) => s + Number(r[chartStat] ?? 0), 0);
    return sum / regWeeks.length;
  }, [regWeeks, chartStat]);

  const snapStat = ["QB", "RB", "FB", "WR", "TE", "K", "P", "T", "G", "C"].includes(pos)
    ? "offense_pct" : "defense_pct";

  if (indexQ.loading && !indexQ.data) return <Screen><Loading /></Screen>;

  const title = String(player?.player_name ?? id);

  return (
    <>
      <Stack.Screen options={{ title }} />
      <Screen refreshing={refreshing} onRefresh={onRefresh} freshnessKey="players/index.json">
        <View style={styles.header}>
          <PlayerAvatar
            url={(player?.headshot_url ?? seasonRowQ.data?.headshot_url) as string}
            name={title}
            size={56}
          />
          <View style={{ flex: 1 }}>
            <Title>{title}</Title>
            <View style={styles.subline}>
              <TeamBadge abbr={player?.team as string} size={20} link />
              <Muted>
                {pos || "?"} · {teamName(player?.team as string)}
                {player ? ` · ${player.first_season}–${player.last_season}` : ""}
              </Muted>
            </View>
          </View>
        </View>

        {injuryQ.data?.report_status ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm,
                         marginBottom: space.md }}>
            <StatusBadge status={injuryQ.data.report_status as string} />
            <Muted>{String(injuryQ.data.report_primary_injury ?? "")}</Muted>
          </View>
        ) : null}

        {/* -------------------------------------------------- projeksiyon */}
        <SectionHeader
          title={projQ.data
            ? t("proj.title", { season: projQ.data.target.season,
                                week: projQ.data.target.week })
            : t("m.projection")}
        />
        {myProj ? (
          <Card>
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm,
                           marginBottom: space.md }}>
              <TeamBadge abbr={String(myProj.team)} size={20} />
              <Muted>vs {String(myProj.opponent)}</Muted>
              <View style={{ flex: 1 }} />
              <Text style={{ color: c.text, fontSize: font.lg, fontWeight: "800" }}>
                {fmt("proj_ppr", myProj.proj_ppr)}
              </Text>
              <Text style={{ color: c.textDim, fontSize: font.xs }}>P·PPR</Text>
            </View>
            {projStatsOf(myProj)
              .filter((s) => s !== "ppr")
              .map((s) => {
                const band = rangeOf(myProj, s);
                const value = Number(myProj[`proj_${s}`] ?? 0);
                return (
                  <View key={s} style={{ marginBottom: space.md }}>
                    <View style={styles.projRow}>
                      <Text style={{ color: c.textDim, fontSize: font.sm, flex: 1 }}>
                        {label(s)}
                      </Text>
                      <Text style={{ color: c.text, fontSize: font.md, fontWeight: "700" }}>
                        {fmt(`proj_${s}`, myProj[`proj_${s}`])}
                      </Text>
                    </View>
                    {band ? (
                      <RangeBar lo={band[0]} mid={value} hi={band[1]} />
                    ) : null}
                  </View>
                );
              })}
          </Card>
        ) : (
          <Empty text={t("m.noProjection")} />
        )}

        {/* ---------------------------------------------------- sezon seçimi */}
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

        {/* ------------------------------------------------------- maç maç */}
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
            {average !== null ? (
              <Muted style={{ marginTop: space.sm }}>
                {label(chartStat)} · {t("common.week")} Ø {average.toFixed(1)}
                {" · "}{regWeeks.length} REG
              </Muted>
            ) : null}
          </Card>
        ) : weeksQ.loading ? <Loading /> : <Empty text={t("player.dnp")} />}

        {weeksQ.data && weeksQ.data.length > 0 ? (
          <View style={{ marginTop: space.md }}>
            <StatTable
              rows={weeksQ.data}
              columns={["week", "opponent_team", ...preset]}
              defaultSort="week"
              firstWidth={64}
            />
          </View>
        ) : null}

        {/* --------------------------------------------------- red zone / snap */}
        {rzQ.data ? (
          <>
            <SectionHeader title={t("player.redzone", { season: active ?? "" })} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ gap: space.sm }}>
              {(RZ_COLS[pos] ?? RZ_COLS.REC).map((s) => (
                <StatTile key={s} label={label(s)} value={fmt(s, rzQ.data![s])} />
              ))}
            </ScrollView>
          </>
        ) : null}

        {snapsQ.data && snapsQ.data.length > 0 ? (
          <>
            <SectionHeader title={t("player.snapCounts", { season: active ?? "" })} />
            <Card>
              <WeekBars
                data={snapsQ.data.map((r) => ({
                  label: String(r.week),
                  value: Math.round(Number(r[snapStat] ?? 0) * 100),
                }))}
                height={120}
                valueFormat={(v) => `${Math.round(v)}%`}
              />
              <Muted style={{ marginTop: space.sm }}>{label(snapStat)}</Muted>
            </Card>
          </>
        ) : null}

        {/* ------------------------------------------------------- kariyer */}
        {careerQ.data && careerQ.data.length > 0 ? (
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
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  subline: {
    flexDirection: "row", alignItems: "center", gap: 6, marginTop: -space.sm,
  },
  projRow: { flexDirection: "row", alignItems: "center", marginBottom: space.xs },
});
