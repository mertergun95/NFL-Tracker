/** Öngörüler — pipeline'ın haftalık ürettiği form / kullanım / eşleşme
 *  notları. Metinler {en,tr,de} sözlüğü olarak geliyor, localized() çözer. */
import { Fragment } from "react";
import { Stack, useRouter } from "expo-router";
import { Text } from "react-native";
import Screen from "../src/components/Screen";
import { Card, Empty, Loading, Muted, SectionHeader, Title, Trend } from "../src/components/ui";
import { loadInsights } from "../src/lib/data";
import { useAsync, useRefresh } from "../src/lib/hooks";
import { localized, useI18n } from "../src/lib/i18n";
import { font, space, useColors } from "../src/lib/theme";

const SECTIONS: [string, string, string][] = [
  ["matchups", "insights.matchups", "insights.matchupsSub"],
  ["scheme", "insights.scheme", "insights.schemeSub"],
  ["hot", "insights.hot", "insights.hotSub"],
  ["cold", "insights.cold", "insights.coldSub"],
  ["usage", "insights.usage", "insights.usageSub"],
  ["team_power", "insights.teamPower", "insights.teamPowerSub"],
];

export default function Insights() {
  const { t, lang } = useI18n();
  const c = useColors();
  const router = useRouter();

  const q = useAsync((o) => loadInsights(o), []);
  const { refreshing, onRefresh } = useRefresh([q.reload]);

  if (q.loading && !q.data) return <Screen><Loading /></Screen>;

  return (
    <>
      <Stack.Screen options={{ title: t("insights.title") }} />
      <Screen refreshing={refreshing} onRefresh={onRefresh} freshnessKey="insights.json">
        {!q.data ? <Empty text={t("insights.notReady")} /> : (
          <>
            <Title sub={`${t("insights.sub", {
              season: q.data.data_season, week: q.data.through_week,
              ns: q.data.next_game_week.season, nw: q.data.next_game_week.week,
            })} ${q.data.generated_at.slice(0, 10)}`}>
              {t("insights.title")}
            </Title>

            {SECTIONS.map(([key, titleKey, descKey]) => {
              const items = q.data!.sections[key] ?? [];
              if (items.length === 0) return null;
              return (
                <Fragment key={key}>
                  <SectionHeader title={t(titleKey)} />
                  <Muted style={{ marginBottom: space.sm }}>
                    {t(descKey)}
                  </Muted>
                  {items.map((it, i) => (
                    <Card
                      key={`${key}-${i}`}
                      style={{ marginBottom: space.sm }}
                      onPress={
                        it.player_id ? () => router.push(`/player/${it.player_id}`)
                        : it.team ? () => router.push(`/team/${it.team}`)
                        : undefined
                      }
                    >
                      <Text style={{ color: c.text, fontSize: font.md, fontWeight: "700" }}>
                        <Trend kind={it.kind} />
                        {localized(it.title, lang)}
                      </Text>
                      <Muted style={{ marginTop: 4 }}>{localized(it.detail, lang)}</Muted>
                    </Card>
                  ))}
                </Fragment>
              );
            })}
          </>
        )}
      </Screen>
    </>
  );
}
