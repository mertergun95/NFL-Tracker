/** NCAA "Daha" sekmesi. NFL'dekinden farkı: sakatlık raporu, derinlik
 *  listesi ve advanced/şema yok — ESPN box score bunları vermiyor. */
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import Screen from "../../components/Screen";
import { Card, Muted, SectionHeader, Title } from "../../components/ui";
import { useT } from "../../lib/i18n";
import { font, space, useColors } from "../../lib/theme";
import Settings from "../shared/Settings";

const PAGES: { href: string; titleKey: string; descKey: string }[] = [
  { href: "/ncaa/teams", titleKey: "ncaa.teamsTitle", descKey: "teams.sub" },
  { href: "/ncaa/standings", titleKey: "ncaa.standingsTitle", descKey: "ncaa.standingsSub" },
  { href: "/ncaa/rosters", titleKey: "ncaa.rostersTitle", descKey: "ncaa.rostersSub" },
  { href: "/power", titleKey: "power.title", descKey: "power.sub2" },
  { href: "/ncaa/accuracy", titleKey: "acc.title", descKey: "acc.sub2" },
];

export default function NcaaMore() {
  const t = useT();
  const c = useColors();
  const router = useRouter();

  return (
    <Screen>
      <Title>{t("more.title")}</Title>

      {PAGES.map((p) => (
        <Card
          key={p.href}
          style={{ marginBottom: space.sm }}
          onPress={() => router.push(p.href as never)}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.text, fontSize: font.md, fontWeight: "700" }}>
                {t(p.titleKey)}
              </Text>
              <Muted style={{ marginTop: 2 }}>{t(p.descKey)}</Muted>
            </View>
            <Text style={{ color: c.textDim, fontSize: font.lg }}>›</Text>
          </View>
        </Card>
      ))}

      <SectionHeader title={t("more.data")} />
      <Card style={{ marginBottom: space.sm }}>
        <Muted>{t("ncaa.noSecond")}</Muted>
      </Card>

      <Settings />
    </Screen>
  );
}
