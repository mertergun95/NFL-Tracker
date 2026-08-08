/** "Daha" sekmesi: alt ekranlara giriş + ayarlar + yasal bilgi.
 *  Beş sekmeye sığmayan her şey (takımlar, puan durumu, sakatlıklar,
 *  öngörüler, derinlik listesi, karne) buradan açılır. */
import { useCallback, useEffect, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import Screen from "../../src/components/Screen";
import { Card, Muted, PillRow, SectionHeader, Title } from "../../src/components/ui";
import { cacheSize, clearDisk } from "../../src/lib/cache";
import { SITE_URL } from "../../src/lib/config";
import { LANGS, LANG_FULL, useI18n } from "../../src/lib/i18n";
import { font, radius, space, useColors, useTheme, type ThemePref } from "../../src/lib/theme";

const PAGES: { href: string; titleKey: string; descKey: string }[] = [
  { href: "/teams", titleKey: "teams.title", descKey: "teams.sub" },
  { href: "/standings", titleKey: "standings.title", descKey: "standings.sub" },
  { href: "/injuries", titleKey: "inj.title", descKey: "inj.sub2" },
  { href: "/insights", titleKey: "insights.title", descKey: "insights.sub2" },
  { href: "/depth", titleKey: "m.depth", descKey: "depth.sub2" },
  { href: "/accuracy", titleKey: "acc.title", descKey: "acc.sub2" },
];

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export default function More() {
  const { t, lang, setLang } = useI18n();
  const { pref, setPref, c } = useTheme();
  const router = useRouter();
  const [size, setSize] = useState(0);
  const [cleared, setCleared] = useState(false);

  const refreshSize = useCallback(() => setSize(cacheSize()), []);
  useEffect(refreshSize, [refreshSize]);

  return (
    <Screen>
      <Title>{t("more.title")}</Title>

      {PAGES.map((p) => (
        <Card
          key={p.href}
          style={{ marginBottom: space.sm }}
          onPress={() => router.push(p.href as never)}
        >
          <View style={styles.row}>
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

      <SectionHeader title={t("more.settings")} />

      <Card style={{ marginBottom: space.sm }}>
        <Text style={{ color: c.text, fontSize: font.sm, fontWeight: "700",
                       marginBottom: space.sm }}>
          {t("more.language")}
        </Text>
        <PillRow
          options={LANGS.map((l) => ({ value: l, label: LANG_FULL[l] }))}
          value={lang}
          onChange={setLang}
          compact
        />
      </Card>

      <Card style={{ marginBottom: space.sm }}>
        <Text style={{ color: c.text, fontSize: font.sm, fontWeight: "700",
                       marginBottom: space.sm }}>
          {t("more.theme")}
        </Text>
        <PillRow
          options={[
            { value: "system" as ThemePref, label: t("more.themeSystem") },
            { value: "dark" as ThemePref, label: t("more.themeDark") },
            { value: "light" as ThemePref, label: t("more.themeLight") },
          ]}
          value={pref}
          onChange={setPref}
          compact
        />
      </Card>

      <Card style={{ marginBottom: space.sm }}>
        <Text style={{ color: c.text, fontSize: font.sm, fontWeight: "700" }}>
          {t("more.cache")}
        </Text>
        <Muted style={{ marginTop: 2 }}>
          {cleared ? t("more.cacheCleared") : t("more.cacheSize", { size: fmtBytes(size) })}
        </Muted>
        <Pressable
          onPress={() => { clearDisk(); setCleared(true); refreshSize(); }}
          style={[styles.button, { borderColor: c.border, backgroundColor: c.bgRaised }]}
        >
          <Text style={{ color: c.text, fontSize: font.sm, fontWeight: "600" }}>
            {t("more.clearCache")}
          </Text>
        </Pressable>
      </Card>

      <SectionHeader title={t("more.about")} />

      <Card style={{ marginBottom: space.sm }}>
        <Text style={{ color: c.text, fontSize: font.sm, fontWeight: "700" }}>
          {t("more.source")}
        </Text>
        <Muted style={{ marginTop: 4 }}>{t("more.sourceSub")}</Muted>
        <Pressable
          onPress={() => Linking.openURL(SITE_URL)}
          style={[styles.button, { borderColor: c.border, backgroundColor: c.bgRaised }]}
        >
          <Text style={{ color: c.link, fontSize: font.sm, fontWeight: "600" }}>
            {t("more.openSite")}
          </Text>
        </Pressable>
      </Card>

      <Card style={{ marginBottom: space.sm }}>
        <Muted>{t("more.noImages")}</Muted>
      </Card>

      <Card style={{ marginBottom: space.sm }}>
        <Muted>{t("app.footer.disclaimer")}</Muted>
        <Muted style={{ marginTop: space.sm }}>
          {t("app.footer.data")}: nflverse (CC BY 4.0) — {t("app.footer.modified")}.
        </Muted>
        <Muted style={{ marginTop: space.sm }}>{t("more.version", { v: "1.0.0" })}</Muted>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.md },
  button: {
    marginTop: space.md, alignSelf: "flex-start",
    paddingHorizontal: space.lg, paddingVertical: space.sm,
    borderRadius: radius.sm, borderWidth: 1,
  },
});
