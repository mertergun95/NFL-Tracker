/** Ayarlar + hakkında bloğu — NFL ve NCAA "Daha" sekmelerinin ortak alt yarısı. */
import { useCallback, useEffect, useState } from "react";
import Constants from "expo-constants";
import { Linking, Pressable, StyleSheet, Text } from "react-native";
import { Card, Muted, PillRow, SectionHeader } from "../../components/ui";
import { cacheSize, clearDisk } from "../../lib/cache";
import { SITE_URL } from "../../lib/config";
import { LANGS, LANG_FULL, useI18n } from "../../lib/i18n";
import { font, radius, space, useTheme, type ThemePref } from "../../lib/theme";

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export default function Settings() {
  const { t, lang, setLang } = useI18n();
  const { pref, setPref, c } = useTheme();
  const [size, setSize] = useState(0);
  const [cleared, setCleared] = useState(false);

  const refreshSize = useCallback(() => setSize(cacheSize()), []);
  useEffect(refreshSize, [refreshSize]);

  return (
    <>
      <SectionHeader title={t("more.settings")} />

      <Card style={{ marginBottom: space.sm }}>
        <Text style={[styles.label, { color: c.text }]}>{t("more.language")}</Text>
        <PillRow
          options={LANGS.map((l) => ({ value: l, label: LANG_FULL[l] }))}
          value={lang}
          onChange={setLang}
          compact
        />
      </Card>

      <Card style={{ marginBottom: space.sm }}>
        <Text style={[styles.label, { color: c.text }]}>{t("more.theme")}</Text>
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
        <Text style={[styles.label, { color: c.text, marginBottom: 0 }]}>
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
        <Text style={[styles.label, { color: c.text, marginBottom: 0 }]}>
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
          {" "}{t("app.footer.ncaa")}: ESPN.
        </Muted>
        {/* Sürüm elle yazılmaz: app.json ile ayrışmasın diye oradan okunur. */}
        <Muted style={{ marginTop: space.sm }}>
          {t("more.version", { v: Constants.expoConfig?.version ?? "—" })}
        </Muted>
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: font.sm, fontWeight: "700", marginBottom: space.sm },
  button: {
    marginTop: space.md, alignSelf: "flex-start",
    paddingHorizontal: space.lg, paddingVertical: space.sm,
    borderRadius: radius.sm, borderWidth: 1,
  },
});
