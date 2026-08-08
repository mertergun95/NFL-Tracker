import { Tabs } from "expo-router";
import type { ColorValue } from "react-native";
import Icon, { type IconName } from "../../src/components/Icon";
import LeagueSwitch from "../../src/components/LeagueSwitch";
import { useT } from "../../src/lib/i18n";
import { useLeague } from "../../src/lib/league";
import { font, useTheme } from "../../src/lib/theme";

const tabIcon = (name: IconName) =>
  function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    return <Icon name={name} color={String(color)} filled={focused} />;
  };

const headerRight = () => <LeagueSwitch />;

export default function TabsLayout() {
  const { c } = useTheme();
  const { league } = useLeague();
  const t = useT();
  const brand = league === "ncaa" ? "StatGrade · NCAA" : "StatGrade";

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: c.bgSoft },
        headerTintColor: c.text,
        headerTitleStyle: { fontWeight: "700" },
        headerShadowVisible: false,
        headerRight,
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.textDim,
        tabBarStyle: { backgroundColor: c.bgSoft, borderTopColor: c.border },
        tabBarLabelStyle: { fontSize: font.xs, fontWeight: "600" },
        sceneStyle: { backgroundColor: c.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: t("tab.home"), headerTitle: brand,
                   tabBarIcon: tabIcon("home") }}
      />
      <Tabs.Screen
        name="players"
        options={{ title: t("tab.players"), tabBarIcon: tabIcon("players") }}
      />
      <Tabs.Screen
        name="projections"
        options={{ title: t("tab.projections"), tabBarIcon: tabIcon("projections") }}
      />
      <Tabs.Screen
        name="games"
        options={{ title: t("tab.games"), tabBarIcon: tabIcon("games") }}
      />
      <Tabs.Screen
        name="more"
        options={{ title: t("tab.more"), tabBarIcon: tabIcon("more") }}
      />
    </Tabs>
  );
}
