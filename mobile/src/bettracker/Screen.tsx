import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { space, useColors } from '../lib/theme';

/**
 * Screen shell for the bet tracker.
 *
 * The app's own `components/Screen` is built for the stats pages: it carries a
 * pull-to-refresh and the nflverse attribution footer, neither of which belongs
 * on a screen whose data is the user's own and lives on the device. What the
 * bet tracker needs instead is keyboard avoidance, because most of its screens
 * are forms.
 */
export default function BetScreen({ children }: { children: ReactNode }) {
  const c = useColors();
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={{ backgroundColor: c.bg }}
        contentContainerStyle={{
          padding: space.lg,
          paddingBottom: insets.bottom + 96,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
