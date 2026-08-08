/** NFL "Daha" sekmesi: beş sekmeye sığmayan her şeyin girişi + ayarlar. */
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import Screen from "../../components/Screen";
import { Card, Muted, SectionHeader, Title } from "../../components/ui";
import { useT } from "../../lib/i18n";
import { font, space, useColors } from "../../lib/theme";
import Settings from "../shared/Settings";

interface Entry { href: string; titleKey: string; descKey: string }

/** Takım/lig genel bakışı */
const LEAGUE: Entry[] = [
  { href: "/teams", titleKey: "teams.title", descKey: "teams.sub" },
  { href: "/standings", titleKey: "standings.title", descKey: "standings.sub" },
  { href: "/depth", titleKey: "m.depth", descKey: "depth.sub2" },
  { href: "/injuries", titleKey: "inj.title", descKey: "inj.sub2" },
];

/** Analiz araçları */
const TOOLS: Entry[] = [
  { href: "/matchups", titleKey: "nav.matchups", descKey: "match.sub2" },
  { href: "/props", titleKey: "props.title", descKey: "props.sub" },
  { href: "/compare", titleKey: "compare.title", descKey: "compare.sub2" },
  { href: "/charts", titleKey: "charts.title2", descKey: "charts.sub2" },
  { href: "/insights", titleKey: "insights.title", descKey: "insights.sub2" },
  { href: "/accuracy", titleKey: "acc.title", descKey: "acc.sub2" },
];

function Row({ entry }: { entry: Entry }) {
  const t = useT();
  const c = useColors();
  const router = useRouter();
  return (
    <Card
      style={{ marginBottom: space.sm }}
      onPress={() => router.push(entry.href as never)}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.text, fontSize: font.md, fontWeight: "700" }}>
            {t(entry.titleKey)}
          </Text>
          <Muted style={{ marginTop: 2 }}>{t(entry.descKey, { max: 3 })}</Muted>
        </View>
        <Text style={{ color: c.textDim, fontSize: font.lg }}>›</Text>
      </View>
    </Card>
  );
}

export default function More() {
  const t = useT();
  return (
    <Screen>
      <Title>{t("more.title")}</Title>
      {LEAGUE.map((e) => <Row key={e.href} entry={e} />)}

      <SectionHeader title={t("nav.charts")} />
      {TOOLS.map((e) => <Row key={e.href} entry={e} />)}

      <Settings />
    </Screen>
  );
}
