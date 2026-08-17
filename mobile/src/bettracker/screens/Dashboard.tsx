import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { space, useColors } from '../../lib/theme';
import { useI18n } from '../i18n';
import { computeStats, equityCurve } from '../core/stats';
import { settleBet } from '../core/settlement';
import { useApp } from '../state/AppContext';
import { BankrollSwitcher, BetRow, EquityChart } from '../components';
import { Button, Dim, Panel, Row, Stat } from '../ui';

/** Opening screen: where the bankroll stands, what is still running, what just settled. */
export default function Dashboard() {
  const c = useColors();
  const { t, formatMoney, formatPercent } = useI18n();
  const router = useRouter();
  const {
    settings,
    bankrolls,
    scopedBets,
    scopedTransactions,
    activeBankroll,
    currency,
  } = useApp();

  const stats = useMemo(() => computeStats(scopedBets), [scopedBets]);

  const startingCapital = useMemo(
    () =>
      activeBankroll
        ? activeBankroll.startingCapital
        : bankrolls.reduce((sum, b) => sum + b.startingCapital, 0),
    [activeBankroll, bankrolls],
  );

  const curve = useMemo(
    () => equityCurve(scopedBets, startingCapital, scopedTransactions),
    [scopedBets, startingCapital, scopedTransactions],
  );

  const balance = curve[curve.length - 1]?.balance ?? startingCapital;

  const open = useMemo(
    () =>
      scopedBets
        .filter((b) => !settleBet(b).settled)
        .sort((a, b) => a.placedAt - b.placedAt)
        .slice(0, 5),
    [scopedBets],
  );

  const recent = useMemo(
    () =>
      scopedBets
        .filter((b) => settleBet(b).settled)
        .sort((a, b) => (b.settledAt ?? b.placedAt) - (a.settledAt ?? a.placedAt))
        .slice(0, 5),
    [scopedBets],
  );

  if (bankrolls.length === 0) {
    return (
      <View style={{ paddingVertical: space.xxl, alignItems: 'center' }}>
        <Text style={{ fontSize: 40 }}>💰</Text>
        <Text style={{ color: c.text, fontWeight: '700', marginTop: space.md,
                       textAlign: 'center' }}>
          {t('bankroll.empty')}
        </Text>
        <Dim style={{ textAlign: 'center', marginTop: space.sm }}>
          {t('settings.storageNote')}
        </Dim>
        <Button
          label={t('bankroll.new')}
          onPress={() => router.push('/bets/bankrolls')}
          style={{ marginTop: space.lg }}
        />
      </View>
    );
  }

  return (
    <View>
      <BankrollSwitcher />

      <Row gap={space.sm} style={{ flexWrap: 'wrap' }}>
        <Stat
          label={t('dash.profit')}
          value={formatMoney(stats.profit, currency, { sign: true })}
          tone={stats.profit > 0 ? 'good' : stats.profit < 0 ? 'bad' : undefined}
          sub={t('stat.settledCount')}
        />
        <Stat
          label={t('dash.yield')}
          value={formatPercent(stats.yield)}
          tone={stats.yield > 0 ? 'good' : stats.yield < 0 ? 'bad' : undefined}
          sub={`${stats.settledCount} ${t('bet.bets')}`}
        />
        <Stat label={t('dash.balance')} value={formatMoney(balance, currency)} />
        <Stat label={t('dash.hitRate')} value={formatPercent(stats.hitRate)} />
        <Stat label={t('dash.turnover')} value={formatMoney(stats.turnover, currency)} />
        <Stat
          label={t('dash.pendingStake')}
          value={formatMoney(stats.pendingStake, currency)}
          sub={`${stats.pendingCount} ${t('bet.bets')}`}
        />
      </Row>

      <Panel title={t('dash.capitalGrowth')} style={{ marginTop: space.md }}>
        <EquityChart points={curve} mode="balance" />
      </Panel>

      <Panel
        title={t('dash.openPanel')}
        action={
          open.length > 0 ? (
            <Button label={t('action.viewAll')} tone="ghost"
                    onPress={() => router.push('/bets/log')} />
          ) : undefined
        }
      >
        {open.length === 0 ? (
          <Dim>{t('dash.noOpenBets')}</Dim>
        ) : (
          open.map((bet) => (
            <BetRow
              key={bet.id}
              bet={bet}
              oddsFormat={settings.oddsFormat}
              onPress={() => router.push(`/bets/bet/${bet.id}` as never)}
            />
          ))
        )}
      </Panel>

      <Panel title={t('dash.settledPanel')}>
        {recent.length === 0 ? (
          <Dim>{t('dash.noSettledBets')}</Dim>
        ) : (
          recent.map((bet) => (
            <BetRow
              key={bet.id}
              bet={bet}
              oddsFormat={settings.oddsFormat}
              onPress={() => router.push(`/bets/bet/${bet.id}` as never)}
            />
          ))
        )}
      </Panel>
    </View>
  );
}
