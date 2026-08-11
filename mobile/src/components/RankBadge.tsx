/** Küçük renkli rozet: rakibin savunma sırası ya da 0-10 fikstür skoru.
 *
 *  İki ölçek ters yönde çalışıyor, ikisi de aynı renk diline indirgeniyor —
 *  yeşil kolay maç, kırmızı zor:
 *   - `rank` + `invert`: savunma sıralaması (1 = en iyi savunma = zor)
 *   - `score`: PFF SOS, 0-10 ve yüksek = kolay
 */
import { StyleSheet, Text, View } from "react-native";
import { radius, useColors } from "../lib/theme";

export default function RankBadge({ rank, total = 32, invert, score }: {
  rank?: number | null;
  total?: number;
  invert?: boolean;
  score?: number | null;
}) {
  const c = useColors();

  let text: string;
  let ease: number;
  if (rank !== null && rank !== undefined) {
    text = `#${rank}`;
    ease = invert ? (rank - 1) / (total - 1) : 1 - (rank - 1) / (total - 1);
  } else if (score !== null && score !== undefined) {
    text = score.toFixed(1);
    ease = score / 10;
  } else {
    return null;
  }

  const easy = ease >= 0.62;
  const hard = ease <= 0.38;
  return (
    <View style={[styles.badge, {
      backgroundColor: easy ? c.goodBg : hard ? c.badBg : c.bgRaised,
    }]}>
      <Text style={{ color: easy ? c.good : hard ? c.bad : c.textDim,
                     fontSize: 9, fontWeight: "700" }}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 4, paddingVertical: 1, borderRadius: radius.sm,
    minWidth: 22, alignItems: "center",
  },
});
