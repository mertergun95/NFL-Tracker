/** Eşleşme analizi — yaklaşan haftanın maçları, takım güç sıralamaları,
 *  savunmaların pozisyona verdiği ve iki takımın öne çıkan projeksiyonları. */
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import Screen from "../src/components/Screen";
import TeamBadge from "../src/components/TeamBadge";
import PName from "../src/components/PName";
import {
  Card, Empty, Loading, Muted, PillRow, SectionHeader, Title,
} from "../src/components/ui";
import {
  loadNextSchedule, loadOptional, loadProjections, loadTeamAdvanced,
} from "../src/lib/data";
import { useAsync, useRefresh } from "../src/lib/hooks";
import { fmt, label } from "../src/lib/columns";
import { teamName } from "../src/lib/teams";
import { etLocal } from "../src/lib/time";
import { translate, useT } from "../src/lib/i18n";
import { font, radius, space, useColors } from "../src/lib/theme";
import type { StatRow } from "../src/lib/types";

/** [kolon, yüksek mi iyi] */
const POWER_ROWS: [string, boolean][] = [
  ["off_epa_play", true], ["off_pass_epa", true], ["off_rush_epa", true],
  ["off_success_rate", true], ["off_explosive_rate", true], ["off_rz_td_pct", true],
  ["def_epa_play", false], ["def_pass_epa", false], ["def_rush_epa", false],
  ["def_sack_rate", true],
];

const ALLOWED_ROWS: [string, string][] = [
  ["receptions", "match.allowedRecCt"], ["receiving_yards", "match.allowedRecYds"],
  ["rushing_yards", "match.allowedRush"], ["passing_yards", "match.allowedPass"],
];

function rankOf(rows: StatRow[], team: string, col: string, highGood: boolean): number {
  const vals = rows
    .filter((r) => typeof r[col] === "number")
    .sort((a, b) => (highGood
      ? Number(b[col]) - Number(a[col])
      : Number(a[col]) - Number(b[col])));
  return vals.findIndex((r) => r.team === team) + 1;
}

function RankChip({ rank }: { rank: number }) {
  const c = useColors();
  const tone = !rank ? c.textDim : rank <= 8 ? c.good : rank >= 25 ? c.bad : c.textDim;
  const bg = !rank ? "transparent" : rank <= 8 ? c.goodBg : rank >= 25 ? c.badBg : "transparent";
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <Text style={{ color: tone, fontSize: 10, fontWeight: "700" }}>
        {rank ? `#${rank}` : "—"}
      </Text>
    </View>
  );
}

export default function Matchups() {
  const t = useT();
  const c = useColors();
  const router = useRouter();
  const [gameKey, setGameKey] = useState<string | null>(null);

  const schedQ = useAsync((o) => loadNextSchedule(o), []);
  const projQ = useAsync((o) => loadProjections(o), []);
  const dataSeason = projQ.data?.data_season;
  const advQ = useAsync(
    (o) => (dataSeason ? loadTeamAdvanced(dataSeason, o) : Promise.resolve(null)),
    [dataSeason]);
  const schemeQ = useAsync(
    (o) => (dataSeason ? loadOptional(`seasons/${dataSeason}/team_scheme.json`, o)
                       : Promise.resolve(null)),
    [dataSeason]);
  const allowedQ = useAsync((o) => loadOptional("pos_allowed.json", o), []);

  const { refreshing, onRefresh } = useRefresh([
    schedQ.reload, projQ.reload, advQ.reload, schemeQ.reload, allowedQ.reload,
  ]);

  const week = projQ.data?.target.week ?? 1;
  const games = useMemo(
    () => (schedQ.data ?? []).filter((g) => Number(g.week) === week),
    [schedQ.data, week],
  );

  const activeKey = gameKey && games.some((g) => String(g.game_id) === gameKey)
    ? gameKey : String(games[0]?.game_id ?? "");
  const game = games.find((g) => String(g.game_id) === activeKey);

  if (schedQ.loading && !schedQ.data) return <Screen><Loading /></Screen>;
  if (!game)
    return (
      <>
        <Stack.Screen options={{ title: t("nav.matchups") }} />
        <Screen refreshing={refreshing} onRefresh={onRefresh}>
          <Empty text={t("match.noFixture")} />
        </Screen>
      </>
    );

  const away = String(game.away_team), home = String(game.home_team);
  const advRow = (tm: string) => advQ.data?.find((r) => r.team === tm) ?? null;
  const schemeRow = (tm: string) => schemeQ.data?.find((r) => r.team === tm) ?? null;
  const allowedRow = (tm: string, pos: string) =>
    allowedQ.data?.find((r) => r.team === tm && r.position === pos) ?? null;
  const projFor = (tm: string) =>
    (projQ.data?.rows ?? []).filter((p) => p.team === tm).slice(0, 5);

  return (
    <>
      <Stack.Screen options={{ title: t("nav.matchups") }} />
      <Screen refreshing={refreshing} onRefresh={onRefresh}
              freshnessKey="next_schedule.json">
        <Title sub={t("match.sub", { season: dataSeason ?? "" })}>
          {t("match.title", { season: projQ.data?.target.season ?? "", week })}
        </Title>

        <PillRow
          options={games.map((g) => ({
            value: String(g.game_id),
            label: `${g.away_team}–${g.home_team}`,
          }))}
          value={activeKey}
          onChange={setGameKey}
          compact
        />

        <Card style={{ marginTop: space.md }}>
          <View style={styles.hero}>
            <View style={styles.heroSide}>
              <TeamBadge abbr={away} size={40} link />
              <Text numberOfLines={2} style={[styles.heroName, { color: c.text }]}>
                {teamName(away)}
              </Text>
            </View>
            <Text style={{ color: c.textDim, fontSize: font.md }}>@</Text>
            <View style={styles.heroSide}>
              <TeamBadge abbr={home} size={40} link />
              <Text numberOfLines={2} style={[styles.heroName, { color: c.text }]}>
                {teamName(home)}
              </Text>
            </View>
          </View>
          <Muted style={{ textAlign: "center", marginTop: space.sm }}>
            {String(game.gameday)}
            {etLocal(game.gameday, game.gametime)
              ? ` · ${etLocal(game.gameday, game.gametime)}` : ""}
            {game.stadium ? ` · ${game.stadium}` : ""}
          </Muted>
        </Card>

        <SectionHeader title={t("match.power")} />
        {advQ.data ? (
          <Card>
            {POWER_ROWS.map(([col, highGood]) => (
              <View key={col} style={[styles.powerRow, { borderBottomColor: c.border }]}>
                <Text style={{ color: c.text, fontSize: font.sm, fontWeight: "600",
                               width: 54 }}>
                  {fmt(col, advRow(away)?.[col] ?? null)}
                </Text>
                <RankChip rank={rankOf(advQ.data ?? [], away, col, highGood)} />
                <Text numberOfLines={2}
                      style={{ color: c.textDim, fontSize: font.xs, flex: 1,
                               textAlign: "center" }}>
                  {label(col)}
                </Text>
                <RankChip rank={rankOf(advQ.data ?? [], home, col, highGood)} />
                <Text style={{ color: c.text, fontSize: font.sm, fontWeight: "600",
                               width: 54, textAlign: "right" }}>
                  {fmt(col, advRow(home)?.[col] ?? null)}
                </Text>
              </View>
            ))}
          </Card>
        ) : (
          <Empty text={t("team.noAdvanced")} />
        )}

        {schemeQ.data ? (
          <>
            <SectionHeader title={t("match.schemes")} />
            <Card>
              {["man_rate", "zone_rate", "blitz_rate_ftn", "avg_pass_rushers"].map((col) => (
                <View key={col} style={[styles.powerRow, { borderBottomColor: c.border }]}>
                  <Text style={{ color: c.text, fontSize: font.sm, width: 60,
                                 fontWeight: "600" }}>
                    {fmt(col, schemeRow(away)?.[col] ?? null)}
                  </Text>
                  <Text numberOfLines={1}
                        style={{ color: c.textDim, fontSize: font.xs, flex: 1,
                                 textAlign: "center" }}>
                    {label(col)}
                  </Text>
                  <Text style={{ color: c.text, fontSize: font.sm, width: 60,
                                 textAlign: "right", fontWeight: "600" }}>
                    {fmt(col, schemeRow(home)?.[col] ?? null)}
                  </Text>
                </View>
              ))}
            </Card>
          </>
        ) : null}

        {allowedQ.data ? (
          <>
            <SectionHeader title={t("match.allowed")} />
            {[away, home].map((def) => (
              <Card key={def} style={{ marginBottom: space.sm }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm,
                               marginBottom: space.sm }}>
                  <TeamBadge abbr={def} size={22} />
                  <Text style={{ color: c.text, fontSize: font.sm, fontWeight: "700" }}>
                    {t("match.defenseOf", { team: def })}
                  </Text>
                </View>
                {["QB", "RB", "WR", "TE"].map((pos) => {
                  const r = allowedRow(def, pos);
                  if (!r) return null;
                  const bits = ALLOWED_ROWS
                    .filter(([col]) => typeof r[col] === "number" && Number(r[col]) > 0.05
                      && ((pos === "QB" && col.startsWith("passing"))
                        || (pos === "RB" && (col.startsWith("rush") || col === "receptions"))
                        || ((pos === "WR" || pos === "TE") && col.startsWith("receiv"))))
                    .map(([col, key]) =>
                      `${fmt(col, r[col])} ${translate(key).toLowerCase()} (#${r[`rank_${col}`]})`);
                  if (bits.length === 0) return null;
                  return (
                    <View key={pos} style={styles.allowedRow}>
                      <Text style={{ color: c.text, fontSize: font.xs, fontWeight: "800",
                                     width: 30 }}>
                        {pos}
                      </Text>
                      <Muted style={{ flex: 1 }}>{bits.join(" · ")}</Muted>
                    </View>
                  );
                })}
              </Card>
            ))}
          </>
        ) : null}

        {projQ.data ? (
          <>
            <SectionHeader title={t("match.topPlayers")} action={t("m.seeAll")}
                           onAction={() => router.push("/projections")} />
            {[away, home].map((tm) => (
              <Card key={tm} style={{ marginBottom: space.sm }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm,
                               marginBottom: space.sm }}>
                  <TeamBadge abbr={tm} size={22} />
                  <Text style={{ color: c.text, fontSize: font.sm, fontWeight: "700" }}>
                    {teamName(tm)}
                  </Text>
                </View>
                {projFor(tm).map((p) => {
                  const pos = String(p.position);
                  const line = pos === "QB"
                    ? `${p.proj_passing_yards ?? "—"} ${translate("u.passYd")} · ${p.proj_passing_tds ?? "—"} TD`
                    : pos === "RB"
                      ? `${p.proj_carries ?? "—"} ${translate("u.car")} · ${p.proj_rushing_yards ?? "—"} ${translate("u.yd")}`
                      : `${p.proj_receptions ?? "—"} rec · ${p.proj_receiving_yards ?? "—"} ${translate("u.yd")}`;
                  return (
                    <View key={String(p.player_id)} style={styles.allowedRow}>
                      <View style={{ flex: 1 }}>
                        <PName name={String(p.player_name)} pos={pos}
                               id={String(p.player_id)} />
                      </View>
                      <Text style={{ color: c.text, fontSize: font.xs, fontWeight: "600" }}>
                        {line}
                      </Text>
                    </View>
                  );
                })}
              </Card>
            ))}
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
  powerRow: {
    flexDirection: "row", alignItems: "center", gap: space.xs,
    paddingVertical: 7, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  chip: {
    minWidth: 30, alignItems: "center",
    paddingHorizontal: 4, paddingVertical: 2, borderRadius: radius.sm,
  },
  allowedRow: {
    flexDirection: "row", alignItems: "center", gap: space.sm, paddingVertical: 5,
  },
});
