import type { ReactNode } from 'react';
import { I18nProvider } from './index';
import { useApp } from '../state/AppContext';

/**
 * Feeds the module's own language setting into its dictionary.
 *
 * The bet tracker keeps a separate language from the rest of the app: its
 * dictionary is Turkish and English only, and the setting lives with the rest
 * of the module's preferences so a backup restores it along with everything
 * else. This is the one line that joins the two.
 */
export function BetTrackerI18n({ children }: { children: ReactNode }) {
  const { settings } = useApp();
  return <I18nProvider language={settings.language}>{children}</I18nProvider>;
}
