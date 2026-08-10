/** Maçlar — sezon + hafta seçimi, skorlar ve fikstür.
 *  Playoff haftaları numarayla değil turuyla (WLD/DIV/CH/SB) gösterilir. */
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import Screen from "../../components/Screen";
import TeamBadge from "../../components/TeamBadge";
import {
  Card, Empty, ErrorBox, Loading, Muted, PillRow, Title,
} from "../../components/ui";
import { loadManifest, loadSchedule, seasonsFromManifest } from "../../lib/data";
import { useAsync, useRefresh } from "../../lib/hooks";
import { isPlayoff, typeOfWeek, weekLabel } from "../../lib/schedule";
import { teamName } from "../../lib/teams";
import { etLocal } from "../../lib/time";
import { useT } from "../../lib/i18n";
import { font, space, useColors } from "../../lib/theme";

export default function Games() {
  const t = useT();
  const c = useColors();
  const router = useRouter();
  const [season, setSeason] = useState<number | null>(null);
  const [week, setWeek] = useState<number | null>(null);

  const manifestQ = useAsync((o) => loadManifest(o), []);
  const seasons = manifestQ.data ? seasonsFromManifest(manifestQ.data) : [];
  const active = season ?? seasons[0] ?? null;

  const schedQ = useAsync(
    (o) => (active ? loadSchedule(active, o) : Promise.resolve([])), [active]);
  const { refreshing, onRefresh } = useRefresh([manifestQ.reload, schedQ.reload]);

  const weeks = useMemo(() => {
    if (!schedQ.data) return [];
    return [...new Set(schedQ.data.map((g) => Number(g.week)))].sort((a, b) => a - b);
  }, [schedQ.data]);

  /** Varsayılan hafta: oynanmış son "dolu" hafta.
   *
   *  Sadece "son oynanan hafta" demek bitmiş bir sezonda Super Bowl'a
   *  düşüyor ve ekranda tek maç kalıyordu. En az dört maçı olan son hafta
   *  hem sezon içinde güncel slate'i, hem bitmiş sezonda 18. haftayı verir. */
  const defaultWeek = useMemo(() => {
    if (!schedQ.data || weeks.length === 0) return null;
    const counts = new Map<number, number>();
    for (const g of schedQ.data) {
      if (g.home_score === null) continue;
      const w = Number(g.week);
      counts.set(w, (counts.get(w) ?? 0) + 1);
    }
    const full = [...counts.entries()].filter(([, n]) => n >= 4).map(([w]) => w);
    if (full.length > 0) return Math.max(...full);
    return counts.size > 0 ? Math.max(...counts.keys()) : weeks[0];
  }, [schedQ.data, weeks]);

  useEffect(() => { setWeek(null); }, [active]);

  const activeWeek = week ?? defaultWeek;

  const games = useMemo(
    () => (schedQ.data ?? []).filter((g) => Number(g.week) === activeWeek),
    [schedQ.data, activeWeek],
  );

  const weekOptions = weeks.map((w) => {
    const gt = typeOfWeek(schedQ.data ?? [], w);
    return {
      value: w,
      label: (isPlayoff(gt ?? "") ? "" : `${t("common.weekShort")} `) + weekLabel(w, gt),
    };
  });

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}
            freshnessKey={active ? `seasons/${active}/schedule.json` : undefined}>
      <Title sub={t("games.sub")}>{t("games.title")}</Title>

      <PillRow
        options={seasons.map((s) => ({ value: s, label: String(s) }))}
        value={active ?? 0}
        onChange={setSeason}
      />
      <PillRow options={weekOptions} value={activeWeek ?? 0} onChange={setWeek} compact />

      {schedQ.loading && !schedQ.data ? <Loading /> : null}
      {schedQ.error && !schedQ.data ? (
        <ErrorBox msg={schedQ.error} onRetry={() => schedQ.reload(true)} />
      ) : null}

      <View style={{ marginTop: space.md }}>
        {games.map((g) => {
          const played = g.home_score !== null;
          const away = String(g.away_team), home = String(g.home_team);
          const a = Number(g.away_score), h = Number(g.home_score);
          const kick = etLocal(g.gameday, g.gametime);
          return (
            <Card
              key={String(g.game_id)}
              style={{ marginBottom: space.sm }}
              onPress={() => router.push(`/game/${active}/${g.game_id}`)}
            >
              <View style={styles.row}>
                <View style={[styles.side, { justifyContent: "flex-start" }]}>
                  <TeamBadge abbr={away} size={30} />
                  <View style={{ flexShrink: 1 }}>
                    <Text numberOfLines={1}
                          style={{ color: c.text, fontSize: font.sm, fontWeight: "600" }}>
                      {away}
                    </Text>
                    <Text numberOfLines={1} style={{ color: c.textDim, fontSize: font.xs }}>
                      {teamName(away)}
                    </Text>
                  </View>
                </View>

                <View style={{ alignItems: "center", minWidth: 62 }}>
                  {played ? (
                    <Text style={{ fontSize: font.lg, fontWeight: "800", color: c.text }}>
                      <Text style={{ color: a > h ? c.good : c.textDim }}>{a}</Text>
                      <Text style={{ color: c.textDim }}>–</Text>
                      <Text style={{ color: h > a ? c.good : c.textDim }}>{h}</Text>
                    </Text>
                  ) : (
                    <Text style={{ color: c.textDim, fontSize: font.md }}>@</Text>
                  )}
                </View>

                <View style={[styles.side, { justifyContent: "flex-end" }]}>
                  <View style={{ flexShrink: 1, alignItems: "flex-end" }}>
                    <Text numberOfLines={1}
                          style={{ color: c.text, fontSize: font.sm, fontWeight: "600" }}>
                      {home}
                    </Text>
                    <Text numberOfLines={1} style={{ color: c.textDim, fontSize: font.xs }}>
                      {teamName(home)}
                    </Text>
                  </View>
                  <TeamBadge abbr={home} size={30} />
                </View>
              </View>
              <Muted style={{ marginTop: space.sm, textAlign: "center" }}>
                {String(g.gameday)}{kick ? ` · ${kick}` : ""}
                {played ? "" : ` · ${t("m.scheduled")}`}
              </Muted>
            </Card>
          );
        })}
      </View>

      {!schedQ.loading && games.length === 0 ? (
        <Empty text={t("common.noGameData")} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
  side: { flexDirection: "row", alignItems: "center", gap: space.sm, flex: 1 },
});
