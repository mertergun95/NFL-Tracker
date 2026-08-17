/**
 * Building blocks for the bet tracker screens.
 *
 * The app's own `components/ui.tsx` covers read-only stat screens. The bet
 * tracker is a data-entry app — it needs labelled fields, number entry, pickers
 * and a confirm dialog — so those live here rather than being bolted onto the
 * shared kit that no other screen would use them from.
 *
 * Everything reads the app's theme tokens, so the section looks like the rest
 * of the app rather than like a transplant.
 */
import { useState, type ReactNode } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { font, radius, space, useColors, type Palette } from '../lib/theme';

/* ------------------------------------------------------------------ *
 * Layout
 * ------------------------------------------------------------------ */

export function Panel({
  title,
  action,
  children,
  style,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  return (
    <View
      style={[
        styles.panel,
        { backgroundColor: c.bgSoft, borderColor: c.border },
        style,
      ]}
    >
      {title || action ? (
        <View style={styles.panelHead}>
          {title ? (
            <Text style={{ color: c.text, fontSize: font.md, fontWeight: '700', flex: 1 }}>
              {title}
            </Text>
          ) : (
            <View style={{ flex: 1 }} />
          )}
          {action}
        </View>
      ) : null}
      {children}
    </View>
  );
}

export function Row({
  children,
  gap = space.sm,
  style,
}: {
  children: ReactNode;
  gap?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>
      {children}
    </View>
  );
}

export function Divider() {
  const c = useColors();
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor: c.border,
        marginVertical: space.md,
      }}
    />
  );
}

export function Dim({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const c = useColors();
  return (
    <Text style={[{ color: c.textDim, fontSize: font.sm, lineHeight: 19 }, style]}>
      {children}
    </Text>
  );
}

/* ------------------------------------------------------------------ *
 * Fields
 * ------------------------------------------------------------------ */

export function Field({
  label,
  hint,
  children,
  style,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  return (
    <View style={[{ marginTop: space.md }, style]}>
      <Text style={{ color: c.textDim, fontSize: font.sm, marginBottom: 6 }}>{label}</Text>
      {children}
      {hint ? (
        <Text style={{ color: c.textDim, fontSize: font.xs, marginTop: 4 }}>{hint}</Text>
      ) : null}
    </View>
  );
}

function inputStyle(c: Palette): ViewStyle & TextStyle {
  return {
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.bg,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: 10,
    color: c.text,
    fontSize: font.md,
  };
}

export function Input({
  value,
  onChange,
  placeholder,
  multiline,
  autoCapitalize = 'sentences',
  secure,
  style,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  secure?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={c.textDim}
      multiline={multiline}
      secureTextEntry={secure}
      autoCapitalize={autoCapitalize}
      autoCorrect={false}
      style={[
        inputStyle(c),
        multiline ? { minHeight: 80, textAlignVertical: 'top' } : null,
        style,
      ]}
    />
  );
}

/**
 * Number entry that keeps the raw text while the user is typing.
 *
 * Round-tripping through a number on every keystroke eats the decimal
 * separator the moment it is typed ("1." becomes "1"), which makes entering
 * odds impossible. The text is the state; the number is only derived.
 */
export function NumberInput({
  value,
  onChange,
  placeholder,
  decimals = true,
  style,
}: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  placeholder?: string;
  decimals?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const [text, setText] = useState(value === undefined ? '' : String(value));

  // The value can change from outside (a preset, a reset). Re-seed the text
  // only when it no longer describes the same number.
  const parsedCurrent = parseNumber(text);
  if (parsedCurrent !== value && !isMidEdit(text)) {
    setText(value === undefined ? '' : String(value));
  }

  return (
    <TextInput
      value={text}
      onChangeText={(next) => {
        // Accept a comma: Turkish keyboards put it where the point is expected.
        const cleaned = next.replace(',', '.');
        setText(cleaned);
        onChange(parseNumber(cleaned));
      }}
      placeholder={placeholder}
      placeholderTextColor={c.textDim}
      keyboardType={decimals ? 'decimal-pad' : 'number-pad'}
      style={[inputStyle(c), style]}
    />
  );
}

/** "1.", "-" and "" are halfway through an edit, not a value to overwrite. */
function isMidEdit(text: string): boolean {
  return text === '' || text === '-' || text.endsWith('.');
}

function parseNumber(text: string): number | undefined {
  if (text.trim() === '') return undefined;
  const n = Number(text);
  return Number.isFinite(n) ? n : undefined;
}

export interface Option<T> {
  value: T;
  label: string;
}

/** Horizontal chips. Good up to a handful of short options. */
export function Chips<T extends string | number>({
  options,
  value,
  onChange,
  compact,
}: {
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
  compact?: boolean;
}) {
  const c = useColors();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: space.sm }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => onChange(o.value)}
            style={{
              paddingHorizontal: compact ? space.md : space.lg,
              paddingVertical: compact ? 6 : space.sm,
              borderRadius: radius.pill,
              borderWidth: 1,
              borderColor: active ? c.accent : c.border,
              backgroundColor: active ? c.accent : c.bg,
            }}
          >
            <Text
              style={{
                color: active ? c.accentText : c.text,
                fontSize: compact ? font.xs : font.sm,
                fontWeight: active ? '700' : '500',
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

/** A field that opens a sheet to pick from a long list (bookmakers, leagues). */
export function Picker<T extends string>({
  value,
  options,
  onChange,
  placeholder,
  title,
}: {
  value: T | '';
  options: Option<T>[];
  onChange: (v: T) => void;
  placeholder?: string;
  title?: string;
}) {
  const c = useColors();
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={inputStyle(c)}>
        <Text style={{ color: selected ? c.text : c.textDim, fontSize: font.md }}>
          {selected?.label ?? placeholder ?? '—'}
        </Text>
      </Pressable>

      <Sheet open={open} onClose={() => setOpen(false)} title={title}>
        <ScrollView style={{ maxHeight: 420 }}>
          {options.map((o) => (
            <Pressable
              key={o.value}
              onPress={() => {
                onChange(o.value);
                setOpen(false);
              }}
              style={{
                paddingVertical: 14,
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: c.border,
              }}
            >
              <Text
                style={{
                  color: o.value === value ? c.accent : c.text,
                  fontSize: font.md,
                  fontWeight: o.value === value ? '700' : '400',
                }}
              >
                {o.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </Sheet>
    </>
  );
}

export function Toggle({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md,
                   marginTop: space.md }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.text, fontSize: font.md }}>{label}</Text>
        {hint ? (
          <Text style={{ color: c.textDim, fontSize: font.xs, marginTop: 2 }}>{hint}</Text>
        ) : null}
      </View>
      <Switch value={value} onValueChange={onChange}
              trackColor={{ true: c.accent, false: c.border }} />
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * Actions
 * ------------------------------------------------------------------ */

export function Button({
  label,
  onPress,
  tone = 'primary',
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const bg = tone === 'primary' ? c.accent : tone === 'danger' ? c.bad : 'transparent';
  const fg = tone === 'ghost' ? c.text : c.accentText;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        {
          paddingHorizontal: space.lg,
          paddingVertical: 11,
          borderRadius: radius.md,
          alignItems: 'center',
          backgroundColor: bg,
          borderWidth: tone === 'ghost' ? 1 : 0,
          borderColor: c.border,
          opacity: disabled ? 0.5 : pressed ? 0.75 : 1,
        },
        style,
      ]}
    >
      <Text style={{ color: fg, fontSize: font.sm, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

/** Bottom sheet used by the pickers, the bet form and the confirm dialog. */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  const c = useColors();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: c.bgSoft, borderColor: c.border }]}>
        <View style={styles.panelHead}>
          <Text style={{ color: c.text, fontSize: font.lg, fontWeight: '700', flex: 1 }}>
            {title ?? ''}
          </Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={{ color: c.textDim, fontSize: font.lg }}>✕</Text>
          </Pressable>
        </View>
        {children}
      </View>
    </Modal>
  );
}

export function Confirm({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Sheet open={open} onClose={onCancel} title={title}>
      {message ? <Dim style={{ marginBottom: space.lg }}>{message}</Dim> : null}
      <Row gap={space.md}>
        <Button label={cancelLabel} tone="ghost" onPress={onCancel} style={{ flex: 1 }} />
        <Button label={confirmLabel} tone="danger" onPress={onConfirm} style={{ flex: 1 }} />
      </Row>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ *
 * Read-out
 * ------------------------------------------------------------------ */

export function Stat({
  label,
  value,
  tone,
  sub,
  width,
}: {
  label: string;
  value: string;
  tone?: 'good' | 'bad';
  sub?: string;
  width?: number;
}) {
  const c = useColors();
  const color = tone === 'good' ? c.good : tone === 'bad' ? c.bad : c.text;
  return (
    <View
      style={[
        styles.stat,
        { backgroundColor: c.bgRaised, borderColor: c.border },
        width ? { width } : { flex: 1, minWidth: 132 },
      ]}
    >
      <Text numberOfLines={1} style={{ color: c.textDim, fontSize: font.xs }}>
        {label}
      </Text>
      <Text style={{ color, fontSize: font.xl, fontWeight: '700' }}>{value}</Text>
      {sub ? (
        <Text numberOfLines={1} style={{ color: c.textDim, fontSize: font.xs }}>
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

export function Badge({ label, tone }: { label: string; tone?: 'good' | 'bad' | 'warn' | 'dim' }) {
  const c = useColors();
  const map = {
    good: { bg: c.goodBg, fg: c.good },
    bad: { bg: c.badBg, fg: c.bad },
    warn: { bg: c.warnBg, fg: c.warn },
    dim: { bg: c.bgRaised, fg: c.textDim },
  } as const;
  const { bg, fg } = map[tone ?? 'dim'];
  return (
    <View style={{ backgroundColor: bg, paddingHorizontal: space.sm, paddingVertical: 2,
                   borderRadius: radius.sm, alignSelf: 'flex-start' }}>
      <Text style={{ color: fg, fontSize: font.xs, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.md,
  },
  panelHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginBottom: space.sm,
  },
  stat: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    gap: 2,
  },
  backdrop: { flex: 1, backgroundColor: '#0008' },
  sheet: {
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: space.lg,
    paddingBottom: space.xxl,
  },
});
