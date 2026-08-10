/** Oyuncu adı + pozisyon rozeti. Fotoğraf yok (telif) — sadece metin. */
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { font, radius, useColors } from "../lib/theme";

export function PosTag({ pos }: { pos?: string | null }) {
  const c = useColors();
  if (!pos || pos === "null") return null;
  return (
    <View style={[styles.tag, { backgroundColor: c.bgRaised, borderColor: c.border }]}>
      <Text style={{ color: c.textDim, fontSize: 9, fontWeight: "700" }}>{pos}</Text>
    </View>
  );
}

export default function PName({ name, pos, id, size = font.sm, lines = 1 }:
  { name?: string | null; pos?: string | null; id?: string | null; size?: number;
    /** Dar kolonlarda uzun isimler kesilmesin diye 2 yapılabilir. */
    lines?: number }) {
  const c = useColors();
  const router = useRouter();
  const body = (
    <View style={styles.row}>
      <Text
        numberOfLines={lines}
        style={{ color: id ? c.link : c.text, fontSize: size, flexShrink: 1,
                 lineHeight: size + 3 }}
      >
        {name ?? "—"}
      </Text>
      <PosTag pos={pos} />
    </View>
  );
  if (!id || id === "null") return body;
  return (
    <Pressable
      onPress={() => router.push(`/player/${id}`)}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 5 },
  tag: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
});
