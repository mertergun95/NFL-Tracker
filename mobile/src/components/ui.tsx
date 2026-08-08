/** Ekranların ortak yapı taşları: başlık, kart, hap (pill), arama kutusu,
 *  yükleniyor/hata durumları. Hepsi tema token'larını okur. */
import { useCallback, useEffect, useRef, type ReactNode } from "react";
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput,
  View, type StyleProp, type TextStyle, type ViewStyle,
} from "react-native";
import { font, radius, space, useColors, useTheme } from "../lib/theme";
import { useT } from "../lib/i18n";

export function Title({ children, sub }: { children: ReactNode; sub?: string }) {
  const c = useColors();
  return (
    <View style={{ marginBottom: space.md }}>
      <Text style={{ color: c.text, fontSize: font.xxl, fontWeight: "800" }}>
        {children}
      </Text>
      {sub ? (
        <Text style={{ color: c.textDim, fontSize: font.sm, marginTop: space.xs,
                       lineHeight: 19 }}>
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

export function SectionHeader({ title, action, onAction }:
  { title: string; action?: string; onAction?: () => void }) {
  const c = useColors();
  return (
    <View style={styles.sectionHeader}>
      <Text style={{ color: c.text, fontSize: font.lg, fontWeight: "700", flex: 1 }}>
        {title}
      </Text>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={{ color: c.link, fontSize: font.sm, fontWeight: "600" }}>
            {action}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Card({ children, style, onPress }:
  { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const c = useColors();
  const body = (
    <View style={[styles.card, { backgroundColor: c.bgSoft, borderColor: c.border }, style]}>
      {children}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
      {body}
    </Pressable>
  );
}

export function Muted({ children, style }:
  { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const c = useColors();
  return (
    <Text style={[{ color: c.textDim, fontSize: font.sm, lineHeight: 19 }, style]}>
      {children}
    </Text>
  );
}

export interface PillOption<T extends string | number> {
  value: T;
  label: string;
}

export function PillRow<T extends string | number>({ options, value, onChange, compact }:
  { options: PillOption<T>[]; value: T; onChange: (v: T) => void; compact?: boolean }) {
  const c = useColors();
  const ref = useRef<ScrollView>(null);
  const offsets = useRef(new Map<string, number>());

  // Seçili hap listenin ilerisindeyse (ör. 20. hafta) kullanıcı onu göremiyor;
  // görünür alana kaydırılır. Ölçüm (onLayout) efektten sonra tamamlanabildiği
  // için kaydırma hem seçim değişince hem de ölçüm gelince denenir.
  const scrollToActive = useCallback((v: T) => {
    const x = offsets.current.get(String(v));
    if (x !== undefined) ref.current?.scrollTo({ x: Math.max(0, x - 40), animated: true });
  }, []);

  useEffect(() => { scrollToActive(value); }, [value, scrollToActive]);

  return (
    <ScrollView
      ref={ref}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: space.sm, paddingVertical: space.xs }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => onChange(o.value)}
            onLayout={(e) => {
              offsets.current.set(String(o.value), e.nativeEvent.layout.x);
              if (o.value === value) scrollToActive(value);
            }}
            style={{
              paddingHorizontal: compact ? space.md : space.lg,
              paddingVertical: compact ? 6 : space.sm,
              borderRadius: radius.pill,
              borderWidth: 1,
              borderColor: active ? c.accent : c.border,
              backgroundColor: active ? c.accent : c.bgSoft,
            }}
          >
            <Text
              style={{
                color: active ? c.accentText : c.text,
                fontSize: compact ? font.xs : font.sm,
                fontWeight: active ? "700" : "500",
              }}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function SearchBar({ value, onChange, placeholder }:
  { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const c = useColors();
  const t = useT();
  return (
    <View style={[styles.search, { backgroundColor: c.bgSoft, borderColor: c.border }]}>
      <Text style={{ color: c.textDim, fontSize: font.md }}>⌕</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder ?? t("common.searchPlayer")}
        placeholderTextColor={c.textDim}
        autoCorrect={false}
        autoCapitalize="none"
        style={{ flex: 1, color: c.text, fontSize: font.md, padding: 0 }}
      />
      {value.length > 0 ? (
        <Pressable onPress={() => onChange("")} hitSlop={10}>
          <Text style={{ color: c.textDim, fontSize: font.md }}>✕</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Loading({ label }: { label?: string }) {
  const c = useColors();
  const t = useT();
  return (
    <View style={styles.center}>
      <ActivityIndicator color={c.accent} />
      <Text style={{ color: c.textDim, marginTop: space.sm, fontSize: font.sm }}>
        {label ?? t("common.loading")}
      </Text>
    </View>
  );
}

export function Empty({ text }: { text: string }) {
  const c = useColors();
  return (
    <View style={styles.center}>
      <Text style={{ color: c.textDim, fontSize: font.sm, textAlign: "center" }}>
        {text}
      </Text>
    </View>
  );
}

export function ErrorBox({ msg, onRetry }: { msg: string; onRetry?: () => void }) {
  const c = useColors();
  const t = useT();
  return (
    <View style={[styles.errorBox, { backgroundColor: c.errBg, borderColor: c.errBorder }]}>
      <Text style={{ color: c.errText, fontSize: font.md, fontWeight: "600" }}>
        {t("m.noConnection")}
      </Text>
      <Text style={{ color: c.errText, fontSize: font.xs, marginTop: space.xs }}>
        {msg}
      </Text>
      {onRetry ? (
        <Pressable
          onPress={onRetry}
          style={{
            marginTop: space.md, alignSelf: "flex-start",
            paddingHorizontal: space.lg, paddingVertical: space.sm,
            borderRadius: radius.sm, backgroundColor: c.accent,
          }}
        >
          <Text style={{ color: c.accentText, fontWeight: "700", fontSize: font.sm }}>
            {t("m.retry")}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Sağ tarafta büyük sayı, solda etiket — "künye" satırları için. */
export function KeyValue({ label, value, tone }:
  { label: string; value: string; tone?: "good" | "bad" }) {
  const c = useColors();
  const color = tone === "good" ? c.good : tone === "bad" ? c.bad : c.text;
  return (
    <View style={[styles.kv, { borderBottomColor: c.border }]}>
      <Text style={{ color: c.textDim, fontSize: font.sm, flex: 1 }}>{label}</Text>
      <Text style={{ color, fontSize: font.md, fontWeight: "600" }}>{value}</Text>
    </View>
  );
}

/** Kutucuk halinde istatistik (etiket üstte küçük, değer altta büyük). */
export function StatTile({ label, value, width }:
  { label: string; value: string; width?: number }) {
  const c = useColors();
  return (
    <View
      style={[
        styles.tile,
        { backgroundColor: c.bgRaised, borderColor: c.border },
        width ? { width } : null,
      ]}
    >
      <Text numberOfLines={1} style={{ color: c.textDim, fontSize: font.xs }}>
        {label}
      </Text>
      <Text style={{ color: c.text, fontSize: font.xl, fontWeight: "700" }}>
        {value}
      </Text>
    </View>
  );
}

/** Sakatlık durumu rozeti (web'deki StatusBadge). */
export function StatusBadge({ status }: { status: string | null | undefined }) {
  const c = useColors();
  const { scheme } = useTheme();
  if (!status) return null;
  const s = String(status);
  const map: Record<string, { bg: string; fg: string }> = {
    Out: { bg: c.badBg, fg: c.bad },
    Doubtful: { bg: c.badBg, fg: c.bad },
    Questionable: { bg: c.warnBg, fg: c.warn },
  };
  const tone = map[s] ?? { bg: scheme === "dark" ? c.bgRaised : c.bgSoft, fg: c.textDim };
  return (
    <View style={[styles.badge, { backgroundColor: tone.bg }]}>
      <Text style={{ color: tone.fg, fontSize: font.xs, fontWeight: "700" }}>{s}</Text>
    </View>
  );
}

/** Yön işareti — insights maddelerinde (emoji yok, web ile aynı karar). */
export function Trend({ kind }: { kind?: "up" | "down" }) {
  const c = useColors();
  if (!kind) return null;
  return (
    <Text style={{ color: kind === "up" ? c.good : c.link, fontWeight: "800" }}>
      {kind === "up" ? "▲ " : "▼ "}
    </Text>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: "row", alignItems: "center",
    marginTop: space.xl, marginBottom: space.sm,
  },
  card: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
  },
  search: {
    flexDirection: "row", alignItems: "center", gap: space.sm,
    borderWidth: 1, borderRadius: radius.md,
    paddingHorizontal: space.md, paddingVertical: 10,
  },
  center: { alignItems: "center", justifyContent: "center", padding: space.xl },
  errorBox: { borderWidth: 1, borderRadius: radius.md, padding: space.lg },
  kv: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tile: {
    borderWidth: 1, borderRadius: radius.md,
    paddingHorizontal: space.md, paddingVertical: space.sm,
    minWidth: 92, gap: 2,
  },
  badge: {
    paddingHorizontal: space.sm, paddingVertical: 2,
    borderRadius: radius.sm, alignSelf: "flex-start",
  },
});
