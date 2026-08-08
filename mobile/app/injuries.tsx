/** Sakatlık raporu — en güncel haftanın resmi raporu, takıma göre filtreli.
 *  Takım filtresi web'de logo ızgarası; burada kısaltma rozetleri. */
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import Screen from "../src/components/Screen";
import TeamBadge, { TeamStrip } from "../src/components/TeamBadge";
import PName from "../src/components/PName";
import {
  Card, Empty, Loading, Muted, StatusBadge, Title,
} from "../src/components/ui";
import { loadInjuries } from "../src/lib/data";
import { useAsync, useRefresh } from "../src/lib/hooks";
import { teamName } from "../src/lib/teams";
import { useT } from "../src/lib/i18n";
import { font, radius, space, useColors } from "../src/lib/theme";

const STATUS_ORDER: Record<string, number> = { Out: 0, Doubtful: 1, Questionable: 2 };

export default function Injuries() {
  const t = useT();
  const c = useColors();
  const router = useRouter();
  const [team, setTeam] = useState<string | null>(null);

  const injQ = useAsync((o) => loadInjuries(o), []);
  const { refreshing, onRefresh } = useRefresh([injQ.reload]);

  const latest = useMemo(() => {
    const data = injQ.data;
    if (!data || data.length === 0) return null;
    const maxWeek = Math.max(...data.map((r) => Number(r.week ?? 0)));
    const rows = data
      .filter((r) => Number(r.week ?? 0) === maxWeek && r.report_status)
      .sort((a, b) => (STATUS_ORDER[String(a.report_status)] ?? 9)
                      - (STATUS_ORDER[String(b.report_status)] ?? 9));
    return { week: maxWeek, season: rows[0]?.season, rows };
  }, [injQ.data]);

  const filtered = useMemo(
    () => (latest?.rows ?? []).filter((r) => !team || r.team === team),
    [latest, team],
  );

  if (injQ.loading && !injQ.data) return <Screen><Loading /></Screen>;

  return (
    <>
      <Stack.Screen options={{ title: t("inj.title") }} />
      <Screen refreshing={refreshing} onRefresh={onRefresh} freshnessKey="injuries.json">
        <Title sub={latest
          ? t("inj.sub", { season: String(latest.season), week: String(latest.week) })
          : undefined}>
          {t("inj.title")}
        </Title>

        {!latest ? <Empty text={t("inj.notReady")} /> : (
          <>
            <Pressable
              onPress={() => setTeam(null)}
              style={[styles.allChip, {
                backgroundColor: team === null ? c.accent : c.bgSoft,
                borderColor: team === null ? c.accent : c.border,
              }]}
            >
              <Text style={{ color: team === null ? c.accentText : c.text,
                             fontSize: font.sm, fontWeight: "600" }}>
                {t("common.all")}
              </Text>
            </Pressable>
            <TeamStrip value={team} onChange={setTeam} allowClear size={34} />

            <Muted style={{ marginBottom: space.sm }}>
              {team ? teamName(team) : t("common.all")} · {filtered.length}
            </Muted>

            {filtered.map((r, i) => (
              <Card
                key={`${r.player_id}-${i}`}
                style={{ marginBottom: space.sm }}
                onPress={r.player_id
                  ? () => router.push(`/player/${r.player_id}`) : undefined}
              >
                <View style={styles.row}>
                  <TeamBadge abbr={String(r.team)} size={26} />
                  <View style={{ flex: 1 }}>
                    <PName name={String(r.player_name)} pos={String(r.position ?? "")}
                           size={font.md} />
                    <Muted style={{ marginTop: 2 }}>
                      {String(r.report_primary_injury ?? "—")}
                      {r.practice_status ? ` · ${String(r.practice_status)}` : ""}
                    </Muted>
                  </View>
                  <StatusBadge status={r.report_status as string} />
                </View>
              </Card>
            ))}

            {filtered.length === 0 ? <Empty text={t("inj.none")} /> : null}
          </>
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.md },
  allChip: {
    alignSelf: "flex-start",
    paddingHorizontal: space.md, paddingVertical: space.sm,
    borderRadius: radius.sm, borderWidth: 1,
    marginTop: space.sm,
  },
});
