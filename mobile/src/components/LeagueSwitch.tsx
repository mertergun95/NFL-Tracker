/** Başlıktaki NFL / NCAA anahtarı — web'deki üst çubuk geçişinin karşılığı. */
import { Pressable, StyleSheet, Text, View } from "react-native";
import { font, radius, space, useColors } from "../lib/theme";
import { useLeague, type League } from "../lib/league";

const OPTIONS: { value: League; label: string }[] = [
  { value: "nfl", label: "NFL" },
  { value: "ncaa", label: "NCAA" },
];

export default function LeagueSwitch() {
  const { league, setLeague } = useLeague();
  const c = useColors();
  return (
    <View style={[styles.wrap, { backgroundColor: c.bgRaised, borderColor: c.border }]}>
      {OPTIONS.map((o) => {
        const active = o.value === league;
        return (
          <Pressable
            key={o.value}
            onPress={() => setLeague(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[styles.item, active && { backgroundColor: c.accent }]}
          >
            <Text style={{
              color: active ? c.accentText : c.textDim,
              fontSize: font.xs, fontWeight: "800",
            }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 2,
    marginRight: space.md,
  },
  item: {
    paddingHorizontal: space.md,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
});
