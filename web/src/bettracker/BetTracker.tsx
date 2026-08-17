import { Link, NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { AppProvider, useApp } from '@bt/state/AppContext';
import { I18nProvider, useI18n } from '@bt/i18n';
import Logo from '@bt/components/Logo';
import SyncIndicator from '@bt/components/SyncIndicator';
import Dashboard from '@bt/screens/Dashboard';
import Bets from '@bt/screens/Bets';
import Bankrolls from '@bt/screens/Bankrolls';
import Analytics from '@bt/screens/Analytics';
import Calculators from '@bt/screens/Calculators';
import Settings from '@bt/screens/Settings';
import { useAuth } from '../lib/auth';
import { translate } from '../lib/i18n';
import '@bt/styles.css';

/**
 * The bet tracker, mounted as a section of the stats site rather than as its
 * own application.
 *
 * Two things follow from that and are the only real differences from the
 * standalone build:
 *
 *  - There is no router here. The host mounts this under `/bets/*` inside its
 *    own HashRouter, so the paths below are absolute `/bets/...` links and the
 *    route elements are relative.
 *  - Every rule in `styles.css` is scoped to `.bt-root`, the container this
 *    component renders, so the two stylesheets' generic class names
 *    (`.card`, `.btn`, `.badge`) cannot reach into each other.
 */

const NAV = [
  { to: '/bets', icon: '📊', key: 'nav.dashboard' },
  { to: '/bets/log', icon: '🎯', key: 'nav.bets' },
  { to: '/bets/analytics', icon: '📈', key: 'nav.analytics' },
  { to: '/bets/tools', icon: '🧮', key: 'nav.calculators' },
  { to: '/bets/bankrolls', icon: '💰', key: 'nav.bankrolls' },
  { to: '/bets/settings', icon: '⚙️', key: 'nav.settings' },
] as const;

function Shell() {
  const { t } = useI18n();
  const { ready, settings, updateSettings } = useApp();
  const { signOut } = useAuth();

  if (!ready) {
    return (
      <div className="splash">
        <Logo size={44} />
        <div className="spinner" />
        <span className="bt-small">{t('common.loading')}</span>
      </div>
    );
  }

  const pinned = settings.sidebarPinned;

  return (
    <div className="bt-app">
      <aside className={`sidebar${pinned ? ' sidebar--pinned' : ''}`}>
        <div className="sidebar__brand">
          <Logo size={32} title={t('app.name')} />
          <span className="sidebar__label">{t('app.name')}</span>
        </div>

        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/bets'}
            className={({ isActive }) => `sidebar__item${isActive ? ' is-active' : ''}`}
            title={t(item.key)}
          >
            <span className="sidebar__icon">{item.icon}</span>
            <span className="sidebar__label">{t(item.key)}</span>
          </NavLink>
        ))}

        {/* The way back to the stats site, and out of the session. Both use the
            host's dictionary: they belong to the shell, not to this module. */}
        <Link to="/" className="sidebar__item" title={translate('nav.backToStats')}>
          <span className="sidebar__icon">🏈</span>
          <span className="sidebar__label">{translate('nav.backToStats')}</span>
        </Link>

        <button
          type="button"
          className="sidebar__pin"
          onClick={signOut}
          title={translate('login.signOut')}
        >
          <span className="sidebar__icon">🚪</span>
          <span className="sidebar__label">{translate('login.signOut')}</span>
        </button>

        <button
          type="button"
          className="sidebar__pin"
          onClick={() => updateSettings({ sidebarPinned: !pinned })}
          title={pinned ? t('nav.unpin') : t('nav.pin')}
        >
          <span className="sidebar__icon">{pinned ? '◀' : '▶'}</span>
          <span className="sidebar__label">{pinned ? t('nav.unpin') : t('nav.pin')}</span>
        </button>
      </aside>

      <div className={`sidebar-spacer${pinned ? ' sidebar-spacer--pinned' : ''}`} />

      <div className="main">
        <div className="content">
          <Routes>
            <Route index element={<Dashboard />} />
            <Route path="log" element={<Bets />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="tools" element={<Calculators />} />
            <Route path="bankrolls" element={<Bankrolls />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/bets" replace />} />
          </Routes>
        </div>
      </div>

      <nav className="tabbar">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/bets'}
            className={({ isActive }) => `tabbar__item${isActive ? ' is-active' : ''}`}
          >
            <span className="tabbar__icon">{item.icon}</span>
            <span>{t(item.key)}</span>
          </NavLink>
        ))}
      </nav>

      <SyncIndicator />
    </div>
  );
}

/** Bridges the persisted language setting into the i18n provider. */
function Localised() {
  const { settings } = useApp();
  return (
    <I18nProvider language={settings.language}>
      <Shell />
    </I18nProvider>
  );
}

export default function BetTracker() {
  return (
    <div className="bt-root">
      <AppProvider>
        <Localised />
      </AppProvider>
    </div>
  );
}
