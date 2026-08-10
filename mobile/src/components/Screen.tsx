/** Ekran kabuğu: tema zemini, güvenli alan, aşağı çekerek yenileme ve
 *  altta veri tazeliği / yasal not. Her sekme bunu kullanır. */
import type { ReactNode } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { font, space, useColors } from "../lib/theme";
import { useT } from "../lib/i18n";
import { freshnessOf } from "../lib/cache";
import { relativeTime } from "../lib/time";

interface Props {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Tazelik satırında gösterilecek kaynak yolu (ör. "manifest.json"). */
  freshnessKey?: string;
  /** Kenar boşluğu istemeyen ekranlar (tam genişlik liste) için. */
  flush?: boolean;
}

export default function Screen({
  children, refreshing, onRefresh, freshnessKey = "manifest.json", flush,
}: Props) {
  const c = useColors();
  const t = useT();
  const insets = useSafeAreaInsets();
  const fresh = freshnessOf(freshnessKey);

  return (
    <ScrollView
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={{
        padding: flush ? 0 : space.lg,
        paddingBottom: insets.bottom + 96,
      }}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={!!refreshing}
            onRefresh={onRefresh}
            tintColor={c.textDim}
            colors={[c.accent]}
            progressBackgroundColor={c.bgSoft}
          />
        ) : undefined
      }
    >
      {children}
      <View style={[styles.foot, { borderTopColor: c.border,
                                   paddingHorizontal: flush ? space.lg : 0 }]}>
        {fresh ? (
          <Text style={{ color: c.textDim, fontSize: font.xs }}>
            {t("m.updated", { when: relativeTime(fresh.fetchedAt) })}
            {fresh.fromCache ? ` · ${t("m.offline")}` : ""}
          </Text>
        ) : null}
        <Text style={{ color: c.textDim, fontSize: font.xs, marginTop: 2 }}>
          {t("app.footer.data")}: nflverse (CC BY 4.0) · {t("app.footer.modified")}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  foot: {
    marginTop: space.xxl,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
