/** NCAA özet ekranı.
 *
 *  NFL'den iki yapısal fark var: sezon tipi REG/POST tek sıraya
 *  (ncaaOrd) çevriliyor — bowl haftaları numarayla anlaşılmıyor — ve
 *  fantasy puanı yok, o yüzden "yıldızlar" en yüksek pas/koşu/rec
 *  yardına göre seçiliyor.
 */
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import Screen from "../../components/Screen";
import PName from "../../components/PName";
import NcaaBadge from "../../components/NcaaBadge";
import {
  Card, Empty, ErrorBox, Loading, Muted, SectionHeader, Title,
} from "../../components/ui";
import {
  loadNcaaManifest, loadNcaaNextSchedule, loadNcaaPlayerSeason, loadNcaaPlayerWeeks,
  loadNcaaSchedule, loadNcaaTeams, ncaaOrd, teamMapOf,
} from "../../lib/ncaa";
import { seasonsFromManifest } from "../../lib/data";
import { useAsync, useRefresh } from "../../lib/hooks";
import { fmt, label } from "../../lib/columns";
import { translate, useT } from "../../lib/i18n";
import { font, space, useColors } from "../../lib/theme";
import { kickoffLocal } from "../../lib/time";
import type { StatRow } from "../../lib/types";

const BOARDS = ["passing_yards", "rushing_yards", "receiving_yards"];

function statLine(p: StatRow): string {
  const parts: string[] = [];
  if (Number(p.passing_yards ?? 0) > 0)
    parts.push(`${p.completions}/${p.attempts}, ${p.passing_yards} ${translate("u.passYd")}, ${p.passing_tds ?? 0} TD`);
  if (Number(p.rushing_yards ?? 0) > 30 || Number(p.carries ?? 0) >= 8)
    parts.push(`${p.carries} ${translate("u.car")} ${p.rushing_yards} ${translate("u.yd")}, ${p.rushing_tds ?? 0} TD`);
  if (Number(p.receiving_yards ?? 0) > 30)
    parts.push(`${p.receptions} rec ${p.receiving_yards} ${translate("u.yd")}, ${p.receiving_tds ?? 0} TD`);
  return parts.join(" · ") || "—";
}

export default function NcaaHome() {
  const t = useT();
  const c = useColors();
  const router = useRouter();

  const manifestQ = useAsync((o) => loadNcaaManifest(o), []);
  const seasons = manifestQ.data ? seasonsFromManifest(manifestQ.data) : [];
  const season = seasons[0] ?? null;

  const seasonQ = useAsync(
    (o) => (season ? loadNcaaPlayerSeason(season, o) : Promise.resolve([])), [season]);
  const weeksQ = useAsync(
    (o) => (season ? loadNcaaPlayerWeeks(season, o) : Promise.resolve([])), [season]);
  const schedQ = useAsync(
    (o) => (season ? loadNcaaSchedule(season, o) : Promise.resolve([])), [season]);
  const nextQ = useAsync((o) => loadNcaaNextSchedule(o), []);
  const teamsQ = useAsync((o) => loadNcaaTeams(o), []);
  const tmap = useMemo(() => teamMapOf(teamsQ.data), [teamsQ.data]);

  const { refreshing, onRefresh } = useRefresh([
    manifestQ.reload, seasonQ.reload, weeksQ.reload, schedQ.reload,
    nextQ.reload, teamsQ.reload,
  ]);

  const lastOrd = useMemo(() => {
    const played = (schedQ.data ?? []).filter((g) => g.home_score !== null);
    return played.length ? Math.max(...played.map(ncaaOrd)) : null;
  }, [schedQ.data]);

  const lastLabel = lastOrd === null ? ""
    : lastOrd > 100 ? t("ncaa.bowl")
    : t("ncaa.weekLabel", { n: lastOrd });

  const stars = useMemo(() => {
    if (!weeksQ.data || lastOrd === null) return [];
    return weeksQ.data
      .filter((r) => ncaaOrd(r) === lastOrd)
      .map((r) => ({
        row: r,
        best: Math.max(Number(r.passing_yards ?? 0), Number(r.rushing_yards ?? 0),
                       Number(r.receiving_yards ?? 0)),
      }))
      .sort((a, b) => b.best - a.best)
      .slice(0, 6);
  }, [weeksQ.data, lastOrd]);

  const scores = useMemo(() => {
    if (!schedQ.data || lastOrd === null) return [];
    return schedQ.data
      .filter((g) => g.home_score !== null && ncaaOrd(g) === lastOrd)
      .sort((a, b) => Number(b.home_score) + Number(b.away_score)
                      - Number(a.home_score) - Number(a.away_score))
      .slice(0, 10);
  }, [schedQ.data, lastOrd]);

  const upcoming = useMemo(() => {
    if (!nextQ.data) return [];
    const open = nextQ.data.filter((g) => g.home_score === null);
    if (open.length === 0) return [];
    const minOrd = Math.min(...open.map(ncaaOrd));
    return open
      .filter((g) => ncaaOrd(g) === minOrd)
      .sort((a, b) => String(a.gameday).localeCompare(String(b.gameday)))
      .slice(0, 10);
  }, [nextQ.data]);

  if (manifestQ.loading && !manifestQ.data) return <Screen><Loading /></Screen>;
  if (!manifestQ.data)
    return (
      <Screen refreshing={refreshing} onRefresh={onRefresh}>
        <Empty text={t("ncaa.notReadyGeneric")} />
      </Screen>
    );

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}
            freshnessKey="ncaa/manifest.json">
      <Title sub={`${t("ncaa.dashSub")}${lastLabel ? ` ${t("ncaa.lastPlayed")}${lastLabel}.` : ""}`}>
        {t("ncaa.dashTitle", { season: season ?? "" })}
      </Title>

      {seasonQ.error && !seasonQ.data ? (
        <ErrorBox msg={seasonQ.error} onRetry={() => seasonQ.reload(true)} />
      ) : null}

      {upcoming.length > 0 ? (
        <>
          <SectionHeader title={t("m.nextGames")} action={t("m.seeAll")}
                         onAction={() => router.push("/games")} />
          {upcoming.map((g) => (
            <Card key={String(g.game_id)} style={styles.row}>
              <NcaaBadge abbr={String(g.away_team)} size={24} link />
              <Text numberOfLines={1}
                    style={{ color: c.text, fontSize: font.sm, flex: 1 }}>
                {String(g.away_team)}
              </Text>
              <Text style={{ color: c.textDim, fontSize: font.xs }}>@</Text>
              <NcaaBadge abbr={String(g.home_team)} size={24} link />
              <Text numberOfLines={1}
                    style={{ color: c.text, fontSize: font.sm, flex: 1 }}>
                {String(g.home_team)}
              </Text>
              <Text style={{ color: c.textDim, fontSize: font.xs }}>
                {kickoffLocal(g.kickoff) ?? String(g.gameday)}
              </Text>
            </Card>
          ))}
        </>
      ) : null}

      {stars.length > 0 ? (
        <>
          <SectionHeader title={t("ncaa.topPerf", { label: lastLabel })} />
          {stars.map(({ row }) => (
            <Card
              key={String(row.player_id)}
              style={{ marginBottom: space.sm }}
              onPress={() => router.push(`/ncaa/player/${row.player_id}`)}
            >
              <View style={styles.starRow}>
                <NcaaBadge abbr={String(row.team)} size={26} />
                <View style={{ flex: 1 }}>
                  <PName name={String(row.player_name)} pos={String(row.position ?? "")}
                         size={font.md} />
                  <Muted style={{ marginTop: 2 }}>
                    {String(row.team)} · {statLine(row)}
                  </Muted>
                </View>
              </View>
            </Card>
          ))}
        </>
      ) : null}

      {scores.length > 0 ? (
        <>
          <SectionHeader title={t("ncaa.scores", { label: lastLabel })} />
          {scores.map((g) => (
            <Card
              key={String(g.game_id)}
              style={styles.row}
              onPress={() => router.push(`/ncaa/game/${season}/${g.game_id}`)}
            >
              <NcaaBadge abbr={String(g.away_team)} size={22} />
              <Text numberOfLines={1}
                    style={{ color: c.text, fontSize: font.sm, flex: 1 }}>
                {String(g.away_team)}
              </Text>
              <Text style={{ color: c.text, fontSize: font.md, fontWeight: "700" }}>
                {String(g.away_score)}–{String(g.home_score)}
              </Text>
              <Text numberOfLines={1}
                    style={{ color: c.text, fontSize: font.sm, flex: 1,
                             textAlign: "right" }}>
                {String(g.home_team)}
              </Text>
              <NcaaBadge abbr={String(g.home_team)} size={22} />
            </Card>
          ))}
        </>
      ) : null}

      <SectionHeader title={t("m.leaders")} />
      {seasonQ.loading && !seasonQ.data ? <Loading /> : null}
      {BOARDS.map((stat) => {
        const rows = (seasonQ.data ?? [])
          .filter((p) => p[stat] !== null && Number(p[stat]) > 0)
          .sort((a, b) => Number(b[stat]) - Number(a[stat]))
          .slice(0, 5);
        if (rows.length === 0) return null;
        return (
          <Card key={stat} style={{ marginBottom: space.md }}>
            <Text style={{ color: c.text, fontSize: font.md, fontWeight: "700",
                           marginBottom: space.sm }}>
              {label(stat)}
            </Text>
            {rows.map((p, i) => (
              <View key={String(p.player_id)} style={styles.leaderRow}>
                <Text style={{ color: c.textDim, fontSize: font.xs, width: 16 }}>
                  {i + 1}
                </Text>
                <NcaaBadge abbr={String(p.team)} size={18} />
                <View style={{ flex: 1 }}>
                  <PName name={String(p.player_name)} pos={String(p.position ?? "")} />
                </View>
                <Text style={{ color: c.text, fontSize: font.sm, fontWeight: "700" }}>
                  {fmt(stat, p[stat])}
                </Text>
              </View>
            ))}
          </Card>
        );
      })}

      {tmap.size > 0 ? (
        <Muted style={{ marginTop: space.sm }}>
          {t("ncaa.teamCount", { n: tmap.size })}
        </Muted>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row", alignItems: "center", gap: space.sm,
    marginBottom: space.sm,
  },
  starRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  leaderRow: {
    flexDirection: "row", alignItems: "center", gap: space.sm, paddingVertical: 5,
  },
});
