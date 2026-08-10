/** Özet ekranı — web'deki Dashboard'ın mobil karşılığı.
 *  Sıra, telefonda ne aranıyorsa ona göre: önce sıradaki maçlar, sonra
 *  geçen haftanın öne çıkanları ve skorları, sonra değişim akışı ve
 *  sezon liderleri. */
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import Screen from "../../components/Screen";
import PName from "../../components/PName";
import TeamBadge from "../../components/TeamBadge";
import PlayerAvatar from "../../components/PlayerAvatar";
import {
  Card, Empty, ErrorBox, Loading, Muted, PillRow, SectionHeader, Title, Trend,
} from "../../components/ui";
import {
  loadInsights, loadManifest, loadNextSchedule, loadPlayerSeason, loadPlayerWeeks,
  loadProjections, loadSchedule, seasonsFromManifest,
} from "../../lib/data";
import { useAsync, useRefresh } from "../../lib/hooks";
import { fmt } from "../../lib/columns";
import { localized, useI18n } from "../../lib/i18n";
import { font, space, useColors } from "../../lib/theme";
import { dayLabel, etLocal } from "../../lib/time";
import { weekLabel } from "../../lib/schedule";
import type { StatRow } from "../../lib/types";

const LEADER_BOARDS: { key: string; col: string; pos?: string[] }[] = [
  { key: "dash.passYards", col: "passing_yards", pos: ["QB"] },
  { key: "dash.rushYards", col: "rushing_yards" },
  { key: "dash.recYards", col: "receiving_yards" },
  { key: "dash.totalTd", col: "_total_td" },
];

function statLine(r: StatRow): string {
  const pos = String(r.position);
  if (pos === "QB")
    return `${r.completions}/${r.attempts} · ${r.passing_yards} yd · ${r.passing_tds} TD`;
  if (pos === "RB")
    return `${r.carries} · ${r.rushing_yards} yd · ` +
      `${Number(r.rushing_tds ?? 0) + Number(r.receiving_tds ?? 0)} TD`;
  return `${r.receptions}/${r.targets} · ${r.receiving_yards} yd · ${r.receiving_tds} TD`;
}

function leaderValue(p: StatRow, col: string): number {
  return col === "_total_td"
    ? Number(p.rushing_tds ?? 0) + Number(p.receiving_tds ?? 0)
    : Number(p[col] ?? 0);
}

export default function Home() {
  const { t, lang } = useI18n();
  const c = useColors();
  const router = useRouter();
  const [season, setSeason] = useState<number | null>(null);

  const manifestQ = useAsync((o) => loadManifest(o), []);
  const seasons = manifestQ.data ? seasonsFromManifest(manifestQ.data) : [];
  const active = season ?? seasons[0] ?? null;

  const seasonQ = useAsync(
    (o) => (active ? loadPlayerSeason(active, o) : Promise.resolve([])), [active]);
  const weeksQ = useAsync(
    (o) => (active ? loadPlayerWeeks(active, o) : Promise.resolve([])), [active]);
  const schedQ = useAsync(
    (o) => (active ? loadSchedule(active, o) : Promise.resolve([])), [active]);
  const insightsQ = useAsync((o) => loadInsights(o), []);
  const nextQ = useAsync((o) => loadNextSchedule(o), []);
  const projQ = useAsync((o) => loadProjections(o), []);

  const { refreshing, onRefresh } = useRefresh([
    manifestQ.reload, seasonQ.reload, weeksQ.reload, schedQ.reload,
    insightsQ.reload, nextQ.reload, projQ.reload,
  ]);

  const info = active && manifestQ.data ? manifestQ.data.seasons[String(active)] : null;
  const lastWeek = info?.last_reg_week ?? 0;

  const stars = useMemo(() => {
    if (!weeksQ.data || !lastWeek) return [];
    return weeksQ.data
      .filter((r) => Number(r.week) === lastWeek && r.season_type === "REG"
                     && ["QB", "RB", "WR", "TE"].includes(String(r.position)))
      .sort((a, b) => Number(b.fantasy_points_ppr ?? 0) - Number(a.fantasy_points_ppr ?? 0))
      .slice(0, 6);
  }, [weeksQ.data, lastWeek]);

  const scores = useMemo(() => {
    if (!schedQ.data) return [];
    return schedQ.data
      .filter((g) => Number(g.week) === lastWeek && g.game_type === "REG"
                     && g.home_score !== null)
      .sort((a, b) => (Number(b.home_score) + Number(b.away_score))
                      - (Number(a.home_score) + Number(a.away_score)));
  }, [schedQ.data, lastWeek]);

  const feed = useMemo(() => {
    const s = insightsQ.data?.sections;
    if (!s) return [];
    return [...(s.hot ?? []).slice(0, 3), ...(s.usage ?? []).slice(0, 2),
            ...(s.cold ?? []).slice(0, 2)];
  }, [insightsQ.data]);

  const nextWeek = projQ.data?.target.week;
  const nextGames = useMemo(() => {
    if (!nextQ.data || nextWeek === undefined) return [];
    return nextQ.data
      .filter((g) => Number(g.week) === nextWeek)
      .sort((a, b) => String(a.gameday).localeCompare(String(b.gameday))
                      || String(a.gametime).localeCompare(String(b.gametime)));
  }, [nextQ.data, nextWeek]);

  if (manifestQ.loading && !manifestQ.data) return <Screen><Loading /></Screen>;
  if (manifestQ.error && !manifestQ.data)
    return (
      <Screen>
        <ErrorBox msg={manifestQ.error} onRetry={() => manifestQ.reload(true)} />
      </Screen>
    );

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <Title sub={t("dash.sub", {
        n: seasons.length, season: active ?? "", week: lastWeek,
        date: manifestQ.data?.generated_at.slice(0, 10) ?? "",
      })}>
        {t("nfl.dashTitle", { season: active ?? "" })}
      </Title>

      <PillRow
        options={seasons.map((s) => ({ value: s, label: String(s) }))}
        value={active ?? 0}
        onChange={setSeason}
      />

      {nextGames.length > 0 ? (
        <>
          <SectionHeader
            title={t("dash.nextSlate", {
              season: projQ.data?.target.season ?? "",
              week: weekLabel(nextWeek!, String(nextGames[0].game_type)),
            })}
            action={t("m.seeAll")}
            onAction={() => router.push("/games")}
          />
          {Object.entries(
            nextGames.reduce<Record<string, StatRow[]>>((acc, g) => {
              const d = String(g.gameday);
              (acc[d] ??= []).push(g);
              return acc;
            }, {}),
          ).map(([day, list]) => (
            <View key={day} style={{ marginBottom: space.md }}>
              <Muted style={{ marginBottom: space.xs }}>{dayLabel(day)}</Muted>
              {list.map((g) => (
                <Card key={String(g.game_id)} style={styles.slateRow}>
                  <TeamBadge abbr={String(g.away_team)} size={26} link />
                  <Text style={{ color: c.text, fontSize: font.sm, width: 42 }}>
                    {String(g.away_team)}
                  </Text>
                  <Text style={{ color: c.textDim, fontSize: font.xs }}>@</Text>
                  <TeamBadge abbr={String(g.home_team)} size={26} link />
                  <Text style={{ color: c.text, fontSize: font.sm, flex: 1 }}>
                    {String(g.home_team)}
                  </Text>
                  <Text style={{ color: c.textDim, fontSize: font.xs }}>
                    {etLocal(g.gameday, g.gametime) ?? ""}
                  </Text>
                </Card>
              ))}
            </View>
          ))}
        </>
      ) : null}

      {stars.length > 0 ? (
        <>
          <SectionHeader title={t("m.stars", { week: lastWeek })} />
          {stars.map((r) => (
            <Card
              key={String(r.player_id)}
              style={styles.starRow}
              onPress={() => router.push(`/player/${r.player_id}`)}
            >
              <PlayerAvatar url={r.headshot_url as string}
                            name={String(r.player_name)} size={42} />
              <View style={{ flex: 1, gap: 3 }}>
                <PName name={String(r.player_name)} pos={String(r.position ?? "")}
                       size={font.md} />
                <View style={styles.inline}>
                  <TeamBadge abbr={String(r.team)} size={18} />
                  <Muted>
                    {String(r.team)} vs {String(r.opponent_team)}
                  </Muted>
                </View>
                <Muted>{statLine(r)}</Muted>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ color: c.text, fontSize: font.xl, fontWeight: "800" }}>
                  {fmt("fantasy_points_ppr", r.fantasy_points_ppr)}
                </Text>
                <Text style={{ color: c.textDim, fontSize: font.xs }}>PPR</Text>
              </View>
            </Card>
          ))}
        </>
      ) : null}

      {scores.length > 0 ? (
        <>
          <SectionHeader title={t("m.lastResults", { week: lastWeek })} />
          {scores.slice(0, 8).map((g) => (
            <Card
              key={String(g.game_id)}
              style={styles.scoreRow}
              onPress={() => router.push(`/game/${active}/${g.game_id}`)}
            >
              <View style={[styles.inline, { flex: 1 }]}>
                <TeamBadge abbr={String(g.away_team)} size={22} />
                <Text style={{ color: c.text, fontSize: font.sm }}>
                  {String(g.away_team)}
                </Text>
              </View>
              <Text style={{ color: c.text, fontSize: font.md, fontWeight: "700" }}>
                {String(g.away_score)}–{String(g.home_score)}
              </Text>
              <View style={[styles.inline, { flex: 1, justifyContent: "flex-end" }]}>
                <Text style={{ color: c.text, fontSize: font.sm }}>
                  {String(g.home_team)}
                </Text>
                <TeamBadge abbr={String(g.home_team)} size={22} />
              </View>
            </Card>
          ))}
        </>
      ) : null}

      {feed.length > 0 ? (
        <>
          <SectionHeader
            title={t("m.feed")}
            action={t("m.seeAll")}
            onAction={() => router.push("/insights")}
          />
          {feed.map((it, i) => (
            <Card
              key={i}
              style={{ marginBottom: space.sm }}
              onPress={it.player_id ? () => router.push(`/player/${it.player_id}`) : undefined}
            >
              <Text style={{ color: c.text, fontSize: font.md, fontWeight: "600" }}>
                <Trend kind={it.kind} />
                {localized(it.title, lang)}
              </Text>
              <Muted style={{ marginTop: 2 }}>{localized(it.detail, lang)}</Muted>
            </Card>
          ))}
        </>
      ) : null}

      <SectionHeader title={t("m.leaders")} />
      {seasonQ.loading && !seasonQ.data ? <Loading /> : null}
      {seasonQ.data
        ? LEADER_BOARDS.map(({ key, col, pos }) => {
            const items = [...seasonQ.data!]
              .filter((p) => !pos || pos.includes(String(p.position)))
              .sort((a, b) => leaderValue(b, col) - leaderValue(a, col))
              .slice(0, 5);
            return (
              <Card key={key} style={{ marginBottom: space.md }}>
                <Text style={{ color: c.text, fontSize: font.md, fontWeight: "700",
                               marginBottom: space.sm }}>
                  {t(key)}
                </Text>
                {items.map((p, i) => (
                  <Pressable
                    key={String(p.player_id)}
                    onPress={() => router.push(`/player/${p.player_id}`)}
                    style={[styles.leaderRow, { borderBottomColor: c.border,
                                                borderBottomWidth: i === items.length - 1
                                                  ? 0 : StyleSheet.hairlineWidth }]}
                  >
                    <Text style={{ color: c.textDim, fontSize: font.xs, width: 16 }}>
                      {i + 1}
                    </Text>
                    <View style={{ flex: 1 }}>
                      <PName name={String(p.player_name)} pos={String(p.position ?? "")} />
                    </View>
                    <Text style={{ color: c.textDim, fontSize: font.xs, width: 34 }}>
                      {String(p.team ?? "")}
                    </Text>
                    <Text style={{ color: c.text, fontSize: font.sm, fontWeight: "700" }}>
                      {fmt(col, leaderValue(p, col))}
                    </Text>
                  </Pressable>
                ))}
              </Card>
            );
          })
        : null}

      {!seasonQ.loading && !seasonQ.data && seasonQ.error ? (
        <Empty text={seasonQ.error} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  inline: { flexDirection: "row", alignItems: "center", gap: 6 },
  slateRow: {
    flexDirection: "row", alignItems: "center", gap: space.sm,
    marginBottom: space.sm,
  },
  starRow: {
    flexDirection: "row", alignItems: "center", gap: space.md,
    marginBottom: space.sm,
  },
  scoreRow: {
    flexDirection: "row", alignItems: "center", gap: space.md,
    marginBottom: space.sm,
  },
  leaderRow: {
    flexDirection: "row", alignItems: "center", gap: space.sm,
    paddingVertical: space.sm,
  },
});
