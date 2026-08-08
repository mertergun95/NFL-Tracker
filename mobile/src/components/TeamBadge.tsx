/** Takım rozeti — logo YERİNE geçen kendi çizimimiz.
 *
 *  Web sürümü ESPN CDN'inden logo çekiyor; mağazaya çıkan bir uygulamada
 *  bunu yapmak marka riski demek. Burada yalnızca takımın kısaltması,
 *  takım renginden türetilmiş bir zemin üzerinde yazılıyor: telif/marka
 *  içermeyen, tamamen bize ait bir görsel öğe.
 */
import { useCallback, useEffect, useRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { font, radius, space, useColors } from "../lib/theme";
import { readableOn, teamColor, teamName, TEAM_ABBRS } from "../lib/teams";

interface Props {
  abbr: string | null | undefined;
  size?: number;
  /** true ise dokununca takım sayfasına gider. */
  link?: boolean;
}

export default function TeamBadge({ abbr, size = 26, link }: Props) {
  const router = useRouter();
  const c = useColors();
  if (!abbr || abbr === "null") {
    return <View style={{ width: size, height: size }} />;
  }
  const bg = teamColor(abbr);
  const fg = readableOn(bg);
  const badge = (
    <View
      style={[
        styles.badge,
        {
          width: size, height: size, borderRadius: radius.sm,
          backgroundColor: bg, borderColor: c.border,
        },
      ]}
    >
      <Text
        numberOfLines={1}
        allowFontScaling={false}
        style={{
          // 3 harfli kısaltmalar (SEA, JAX…) kareye sığsın diye daha küçük;
          // adjustsFontSizeToFit'e güvenilmiyor, web'de uygulanmıyor.
          color: fg,
          fontSize: Math.max(7, size * (abbr.length > 2 ? 0.29 : 0.4)),
          fontWeight: "800",
          letterSpacing: -0.4,
        }}
      >
        {abbr}
      </Text>
    </View>
  );
  if (!link) return badge;
  return (
    <Pressable
      onPress={() => router.push(`/team/${abbr}`)}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
    >
      {badge}
    </Pressable>
  );
}

/** Takım seçici şerit — 32 rozet yana kayar, seçili olan görünür alana
 *  getirilir (aksi halde KC seçiliyken ekranda ARI–CLE görünüyordu). */
export function TeamStrip({ value, onChange, allowClear, size = 36 }: {
  value: string | null;
  onChange: (abbr: string | null) => void;
  allowClear?: boolean;
  size?: number;
}) {
  const ref = useRef<ScrollView>(null);
  const offsets = useRef(new Map<string, number>());

  const scrollToActive = useCallback((v: string | null) => {
    if (!v) return;
    const x = offsets.current.get(v);
    if (x !== undefined) ref.current?.scrollTo({ x: Math.max(0, x - 40), animated: true });
  }, []);

  useEffect(() => { scrollToActive(value); }, [value, scrollToActive]);

  return (
    <ScrollView
      ref={ref}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.strip}
    >
      {TEAM_ABBRS.map((abbr) => (
        <Pressable
          key={abbr}
          accessibilityRole="button"
          accessibilityLabel={teamName(abbr)}
          accessibilityState={{ selected: value === abbr }}
          onLayout={(e) => {
            offsets.current.set(abbr, e.nativeEvent.layout.x);
            if (abbr === value) scrollToActive(value);
          }}
          onPress={() => onChange(allowClear && value === abbr ? null : abbr)}
          style={{ opacity: value === null || value === abbr ? 1 : 0.35 }}
        >
          <TeamBadge abbr={abbr} size={size} />
        </Pressable>
      ))}
    </ScrollView>
  );
}

/** Rozet + kısaltma yan yana (tablolarda ve satırlarda). */
export function TeamCell({ abbr, size = 22, showAbbr = true }:
  { abbr: string | null | undefined; size?: number; showAbbr?: boolean }) {
  const c = useColors();
  return (
    <View style={styles.cell}>
      <TeamBadge abbr={abbr} size={size} />
      {showAbbr ? (
        <Text style={{ color: c.text, fontSize: font.sm }}>{abbr ?? "—"}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: "center", justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  cell: { flexDirection: "row", alignItems: "center", gap: 6 },
  strip: { gap: space.sm, paddingVertical: space.sm },
});
