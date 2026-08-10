/** NCAA takım işareti.
 *
 *  NFL'deki TeamBadge ile aynı mantık: Ayarlar'daki "Görseller" açıkken
 *  teams.json'daki ESPN logosu gösterilir, kapalıyken rozet çizilir.
 *
 *  Rozet zemini: NFL'de 32 takımın rengi elle tanımlıydı, 250+ okul için
 *  bu mümkün değil — renk kısaltmadan deterministik türetiliyor. Aynı okul
 *  her yerde aynı rengi alır, hiçbir okulun resmî rengi iddia edilmez.
 */
import { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { font, radius, useColors } from "../lib/theme";
import { readableOn } from "../lib/teams";
import { ncaaLogoUrl } from "../lib/ncaa";
import { useShowImages } from "../lib/prefs";

/** FNV-1a benzeri basit karma — kısaltmadan sabit bir ton üretir. */
function hueOf(abbr: string): number {
  let h = 2166136261;
  for (let i = 0; i < abbr.length; i++) {
    h ^= abbr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % 360;
}

export function ncaaColor(abbr: string | null | undefined): string {
  if (!abbr) return "#4a5568";
  return hslToHex(hueOf(abbr), 52, 32);
}

function hslToHex(h: number, s: number, l: number): string {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l / 100 - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    return Math.round(255 * color).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

interface Props {
  abbr: string | null | undefined;
  size?: number;
  link?: boolean;
}

export default function NcaaBadge({ abbr, size = 26, link }: Props) {
  const router = useRouter();
  const c = useColors();
  const showImages = useShowImages();
  const [broken, setBroken] = useState(false);
  useEffect(() => { setBroken(false); }, [abbr]);

  if (!abbr || abbr === "null") return <View style={{ width: size, height: size }} />;

  const bg = ncaaColor(abbr);
  const fg = readableOn(bg);
  const short = abbr.length > 4 ? abbr.slice(0, 4) : abbr;
  const logo = showImages && !broken ? ncaaLogoUrl(abbr) : null;

  /* Rozet her zaman altta; logo yüklenene kadar delik kalmasın. */
  const badge = (
    <View
      style={[
        styles.badge,
        { width: size, height: size, borderRadius: radius.sm,
          backgroundColor: bg, borderColor: c.border },
      ]}
    >
      <Text
        numberOfLines={1}
        allowFontScaling={false}
        style={{
          color: fg,
          fontSize: Math.max(6, size * (short.length > 3 ? 0.24 : short.length > 2 ? 0.28 : 0.4)),
          fontWeight: "800",
          letterSpacing: -0.4,
        }}
      >
        {short}
      </Text>
      {logo ? (
        <Image
          source={{ uri: logo }}
          style={[StyleSheet.absoluteFill, { width: size, height: size }]}
          resizeMode="contain"
          onError={() => setBroken(true)}
          accessibilityLabel={abbr}
        />
      ) : null}
    </View>
  );

  if (!link) return badge;
  return (
    <Pressable
      onPress={() => router.push(`/ncaa/team/${abbr}`)}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
    >
      {badge}
    </Pressable>
  );
}

export function NcaaTeamCell({ abbr, size = 22, showAbbr = true }:
  { abbr: string | null | undefined; size?: number; showAbbr?: boolean }) {
  const c = useColors();
  return (
    <View style={styles.cell}>
      <NcaaBadge abbr={abbr} size={size} />
      {showAbbr ? (
        <Text numberOfLines={1} style={{ color: c.text, fontSize: font.sm }}>
          {abbr ?? "—"}
        </Text>
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
});
