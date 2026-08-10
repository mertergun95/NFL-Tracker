/** Oyuncu fotoğrafı.
 *
 *  Ayarlar'daki "Görseller" açıkken NFL/ESPN'in verideki fotoğraf URL'i
 *  gösterilir (pakete gömülmez, kaynağından çekilir). Kapalıyken ya da
 *  fotoğraf yoksa/yüklenemezse baş harflerden oluşan bir daire çizilir.
 *
 *  Bilerek yalnızca kart ve künye ekranlarında kullanılıyor: 100 satırlık
 *  bir tabloda 100 uzak görsel kaydırmayı bozar.
 */
import { useEffect, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { useColors } from "../lib/theme";
import { useShowImages } from "../lib/prefs";

/** "Puka Nacua" -> "PN" */
function initialsOf(name: string | null | undefined): string {
  const parts = String(name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface Props {
  url?: string | null;
  name?: string | null;
  size?: number;
}

export default function PlayerAvatar({ url, name, size = 44 }: Props) {
  const c = useColors();
  const showImages = useShowImages();
  const [broken, setBroken] = useState(false);
  useEffect(() => { setBroken(false); }, [url]);

  const clean = url && url !== "null" && url !== "" ? String(url) : null;
  const showPhoto = showImages && clean && !broken;

  if (showPhoto) {
    return (
      <Image
        source={{ uri: clean }}
        style={[styles.avatar, {
          width: size, height: size, borderRadius: size / 2,
          backgroundColor: c.bgRaised,
        }]}
        resizeMode="cover"
        onError={() => setBroken(true)}
        accessibilityLabel={name ?? undefined}
      />
    );
  }

  return (
    <View
      style={[styles.avatar, styles.fallback, {
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: c.bgRaised, borderColor: c.border,
      }]}
    >
      <Text
        allowFontScaling={false}
        style={{ color: c.textDim, fontSize: size * 0.36, fontWeight: "700" }}
      >
        {initialsOf(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { overflow: "hidden" },
  fallback: {
    alignItems: "center", justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
});
