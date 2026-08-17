import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { font, space, useColors, useTheme } from '../../lib/theme';
import { useAuth } from '../../lib/auth';
import { useT } from '../../lib/i18n';
import { useI18n } from '../i18n';
import {
  BACKUP_VERSION,
  betsToCsv,
  buildBackup,
  csvToBets,
  exportFile,
  parseBackup,
  pickTextFile,
} from '../core/io';
import type { Language, OddsFormat, SyncConfig, ThemeMode } from '../core/types';
import { useApp } from '../state/AppContext';
import {
  Button,
  Chips,
  Confirm,
  Dim,
  Divider,
  Field,
  Input,
  NumberInput,
  Panel,
  Row,
  Toggle,
} from '../ui';

const THEMES: ThemeMode[] = ['light', 'dark', 'system'];
const ODDS_FORMATS: OddsFormat[] = ['decimal', 'american', 'fractional'];
const LANGUAGES: Language[] = ['tr', 'en'];

/** Appearance, the user's own lists, cross-device sync, backups and the reset. */
export default function Settings() {
  const c = useColors();
  const { setPref } = useTheme();
  const appT = useT();
  const { t } = useI18n();
  const { signOut } = useAuth();
  const {
    settings,
    bankrolls,
    bets,
    transactions,
    updateSettings,
    resetAll,
    restoreBackup,
    saveBet,
  } = useApp();

  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [newBookmaker, setNewBookmaker] = useState('');
  const [newTipster, setNewTipster] = useState('');

  async function onExportJson() {
    const backup = buildBackup({ bankrolls, bets, transactions, settings });
    await exportFile(
      `bettracker-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(backup, null, 2),
      'application/json',
    );
  }

  async function onExportCsv() {
    const names = new Map(bankrolls.map((b) => [b.id, b.name]));
    await exportFile(
      `bettracker-${new Date().toISOString().slice(0, 10)}.csv`,
      betsToCsv(bets, names),
      'text/csv',
    );
  }

  async function onImportJson() {
    setMessage('');
    setError('');
    const text = await pickTextFile(['application/json', 'text/plain']);
    if (text === null) return;

    const parsed = parseBackup(text);
    if (!parsed.ok || !parsed.data) {
      setError(t(`error.${parsed.error ?? 'generic'}` as never));
      return;
    }
    await restoreBackup(parsed.data);
    setMessage(t('settings.restored'));
  }

  async function onImportCsv() {
    setMessage('');
    setError('');
    const target = bankrolls[0];
    if (!target) {
      setError(t('bet.needBankroll'));
      return;
    }
    const text = await pickTextFile(['text/csv', 'text/comma-separated-values', 'text/plain']);
    if (text === null) return;

    const result = csvToBets(text, {
      bankrollId: target.id,
      defaultBookmaker: settings.defaultBookmaker,
    });
    if (result.errors.length > 0 && result.bets.length === 0) {
      setError(result.errors[0] ?? t('error.generic'));
      return;
    }
    for (const bet of result.bets) await saveBet(bet);
    setMessage(
      result.skipped.length > 0
        ? t('settings.importedSkipped', { n: result.bets.length, skipped: result.skipped.length })
        : t('settings.imported', { n: result.bets.length }),
    );
  }

  return (
    <View>
      <Panel title={t('settings.appearance')}>
        <Field label={t('common.language')}>
          <Chips
            compact
            value={settings.language}
            onChange={(v) => void updateSettings({ language: v })}
            options={LANGUAGES.map((l) => ({
              value: l,
              label: l === 'tr' ? 'Türkçe' : 'English',
            }))}
          />
        </Field>

        <Field label={t('common.theme')}>
          {/* The theme is app-wide: writing it here and to the app's own
              provider keeps the bet tracker's setting from silently doing
              nothing outside this section. */}
          <Chips
            compact
            value={settings.theme}
            onChange={(v) => {
              void updateSettings({ theme: v });
              setPref(v);
            }}
            options={THEMES.map((x) => ({
              value: x,
              label: t(`settings.theme.${x}` as never),
            }))}
          />
        </Field>

        <Field label={t('settings.oddsFormat')}>
          <Chips
            compact
            value={settings.oddsFormat}
            onChange={(v) => void updateSettings({ oddsFormat: v })}
            options={ODDS_FORMATS.map((x) => ({
              value: x,
              label: t(`calc.${x}` as never),
            }))}
          />
        </Field>

        <Field label={t('settings.defaultCommission')}>
          <NumberInput
            value={settings.defaultCommission || undefined}
            onChange={(v) => void updateSettings({ defaultCommission: v ?? 0 })}
            placeholder="0"
          />
        </Field>
      </Panel>

      <Panel title={t('settings.lists')}>
        <ListEditor
          label={t('settings.bookmakers')}
          items={settings.bookmakers}
          draft={newBookmaker}
          onDraft={setNewBookmaker}
          addLabel={t('settings.addBookmaker')}
          onAdd={(name) => void updateSettings({ bookmakers: [...settings.bookmakers, name] })}
          onRemove={(name) =>
            void updateSettings({ bookmakers: settings.bookmakers.filter((x) => x !== name) })
          }
        />
        <Divider />
        <ListEditor
          label={t('settings.tipsters')}
          items={settings.tipsters}
          draft={newTipster}
          onDraft={setNewTipster}
          addLabel={t('settings.addTipster')}
          onAdd={(name) => void updateSettings({ tipsters: [...settings.tipsters, name] })}
          onRemove={(name) =>
            void updateSettings({ tipsters: settings.tipsters.filter((x) => x !== name) })
          }
        />
      </Panel>

      <SyncPanel />

      <Panel title={t('settings.data')}>
        <Dim>{t('settings.storageNote')}</Dim>

        <Button label={t('settings.exportJson')} tone="ghost" onPress={onExportJson}
                style={{ marginTop: space.md }} />
        <Dim style={{ fontSize: font.xs, marginTop: 4 }}>{t('settings.exportJson.hint')}</Dim>

        <Button label={t('settings.exportCsv')} tone="ghost" onPress={onExportCsv}
                style={{ marginTop: space.md }} />
        <Dim style={{ fontSize: font.xs, marginTop: 4 }}>{t('settings.exportCsv.hint')}</Dim>

        <Button label={t('settings.importJson')} tone="ghost" onPress={onImportJson}
                style={{ marginTop: space.md }} />
        <Dim style={{ fontSize: font.xs, marginTop: 4 }}>{t('settings.importJson.hint')}</Dim>

        <Button label={t('settings.importCsv')} tone="ghost" onPress={onImportCsv}
                style={{ marginTop: space.md }} />
        <Dim style={{ fontSize: font.xs, marginTop: 4 }}>{t('settings.importCsv.hint')}</Dim>

        {message ? (
          <Text style={{ color: c.good, fontSize: font.sm, marginTop: space.md }}>{message}</Text>
        ) : null}
        {error ? (
          <Text style={{ color: c.bad, fontSize: font.sm, marginTop: space.md }}>{error}</Text>
        ) : null}
      </Panel>

      <Panel title={t('settings.about')}>
        <Row style={{ paddingVertical: 4 }}>
          <Dim style={{ flex: 1 }}>{t('bankroll.title')}</Dim>
          <Text style={{ color: c.text }}>{bankrolls.length}</Text>
        </Row>
        <Row style={{ paddingVertical: 4 }}>
          <Dim style={{ flex: 1 }}>{t('bet.bets')}</Dim>
          <Text style={{ color: c.text }}>{bets.length}</Text>
        </Row>
        <Row style={{ paddingVertical: 4 }}>
          <Dim style={{ flex: 1 }}>{t('tx.title')}</Dim>
          <Text style={{ color: c.text }}>{transactions.length}</Text>
        </Row>
        <Row style={{ paddingVertical: 4 }}>
          <Dim style={{ flex: 1 }}>{t('settings.version')}</Dim>
          <Text style={{ color: c.text }}>v{BACKUP_VERSION}</Text>
        </Row>
      </Panel>

      <Panel title={t('settings.danger')}>
        <Button label={appT('login.signOut')} tone="ghost" onPress={signOut} />
        <Button
          label={t('settings.resetApp')}
          tone="danger"
          onPress={() => setResetting(true)}
          style={{ marginTop: space.md }}
        />
        <Dim style={{ fontSize: font.xs, marginTop: 4 }}>{t('settings.resetApp.hint')}</Dim>
      </Panel>

      <Confirm
        open={resetting}
        title={t('settings.resetApp')}
        message={t('settings.resetConfirm')}
        confirmLabel={t('action.reset')}
        cancelLabel={t('action.cancel')}
        onCancel={() => setResetting(false)}
        onConfirm={() => {
          void resetAll();
          setResetting(false);
        }}
      />
    </View>
  );
}

function ListEditor({
  label,
  items,
  draft,
  onDraft,
  addLabel,
  onAdd,
  onRemove,
}: {
  label: string;
  items: string[];
  draft: string;
  onDraft: (v: string) => void;
  addLabel: string;
  onAdd: (name: string) => void;
  onRemove: (name: string) => void;
}) {
  const c = useColors();
  const { t } = useI18n();

  return (
    <View>
      <Text style={{ color: c.text, fontSize: font.md, fontWeight: '600' }}>{label}</Text>

      {items.length === 0 ? (
        <Dim style={{ marginTop: space.sm }}>{t('common.empty')}</Dim>
      ) : (
        <Row gap={space.sm} style={{ flexWrap: 'wrap', marginTop: space.sm }}>
          {items.map((name) => (
            <Pressable
              key={name}
              onPress={() => onRemove(name)}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 6,
                paddingHorizontal: space.md, paddingVertical: 5,
                borderRadius: 999, borderWidth: 1, borderColor: c.border,
              }}
            >
              <Text style={{ color: c.text, fontSize: font.xs }}>{name}</Text>
              <Text style={{ color: c.textDim, fontSize: font.xs }}>✕</Text>
            </Pressable>
          ))}
        </Row>
      )}

      <Row gap={space.sm} style={{ marginTop: space.md }}>
        <Input value={draft} onChange={onDraft} style={{ flex: 1 }} />
        <Button
          label={addLabel}
          tone="ghost"
          onPress={() => {
            const name = draft.trim();
            if (!name || items.includes(name)) return;
            onAdd(name);
            onDraft('');
          }}
        />
      </Row>
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * GitHub sync
 * ------------------------------------------------------------------ */

function SyncPanel() {
  const c = useColors();
  const { t, formatDate } = useI18n();
  const { settings, updateSettings, sync, syncNow } = useApp();

  const config = settings.sync;
  const [owner, setOwner] = useState(config?.owner ?? '');
  const [repo, setRepo] = useState(config?.repo ?? '');
  const [branch, setBranch] = useState(config?.branch ?? 'main');
  const [path, setPath] = useState(config?.path ?? 'bettracker.json');
  const [token, setToken] = useState(config?.token ?? '');
  const [disconnecting, setDisconnecting] = useState(false);

  const connected = !!config?.token && !!config.owner && !!config.repo;

  async function onConnect() {
    const next: SyncConfig = {
      owner: owner.trim(),
      repo: repo.trim(),
      branch: branch.trim() || 'main',
      path: path.trim() || 'bettracker.json',
      token: token.trim(),
      auto: config?.auto ?? true,
    };
    await updateSettings({ sync: next });
    await syncNow();
  }

  return (
    <Panel title={t('sync.title')}>
      <Dim>{t('sync.intro')}</Dim>

      <Row gap={space.md}>
        <Field label={t('sync.owner')} style={{ flex: 1 }}>
          <Input value={owner} onChange={setOwner} autoCapitalize="none" />
        </Field>
        <Field label={t('sync.repo')} style={{ flex: 1 }}>
          <Input value={repo} onChange={setRepo} autoCapitalize="none" />
        </Field>
      </Row>

      <Row gap={space.md}>
        <Field label={t('sync.branch')} style={{ flex: 1 }}>
          <Input value={branch} onChange={setBranch} autoCapitalize="none" />
        </Field>
        <Field label={t('sync.path')} style={{ flex: 1 }}>
          <Input value={path} onChange={setPath} autoCapitalize="none" />
        </Field>
      </Row>

      <Field label={t('sync.token')} hint={t('sync.token.hint')}>
        <Input value={token} onChange={setToken} autoCapitalize="none" secure />
      </Field>

      {connected ? (
        <Toggle
          label={t('sync.auto')}
          hint={t('sync.auto.hint')}
          value={config?.auto ?? false}
          onChange={(v) => void updateSettings({ sync: { ...config!, auto: v } })}
        />
      ) : null}

      <Row gap={space.md} style={{ marginTop: space.lg }}>
        <Button
          label={connected ? t('sync.now') : t('sync.connect')}
          onPress={() => void (connected ? syncNow() : onConnect())}
          style={{ flex: 1 }}
        />
        {connected ? (
          <Button
            label={t('sync.disconnect')}
            tone="ghost"
            onPress={() => setDisconnecting(true)}
            style={{ flex: 1 }}
          />
        ) : null}
      </Row>

      <Text style={{ marginTop: space.md, fontSize: font.sm,
                     color: sync.status === 'error' ? c.bad
                          : sync.status === 'ok' ? c.good : c.textDim }}>
        {sync.status === 'syncing' ? t('sync.syncing')
          : sync.status === 'error' ? t(`sync.error.${sync.errorCode ?? 'http'}` as never)
          : sync.status === 'ok' && sync.lastSyncAt
            ? `${t('sync.lastSync')}: ${formatDate(sync.lastSyncAt, 'dateTime')}`
          : t('sync.never')}
      </Text>

      <Confirm
        open={disconnecting}
        title={t('sync.disconnect')}
        message={t('sync.disconnectConfirm')}
        confirmLabel={t('sync.disconnect')}
        cancelLabel={t('action.cancel')}
        onCancel={() => setDisconnecting(false)}
        onConfirm={() => {
          void updateSettings({ sync: undefined });
          setToken('');
          setDisconnecting(false);
        }}
      />
    </Panel>
  );
}
