import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { font, space, useColors } from '../../lib/theme';
import { useI18n } from '../i18n';
import { formatOdds } from '../core/odds';
import {
  breakdownBy,
  computeStats,
  monthlyBreakdown,
  oddsBand,
  weekdayBreakdown,
  type BreakdownRow,
} from '../core/stats';
import type { Bet } from '../core/types';
import { useApp } from '../state/AppContext';
import { BankrollSwitcher } from '../components';
import { Chips, Dim, Panel, Row, Stat, StatGrid } from '../ui';

type Dimension =
  | 'sport'
  | 'competition'
  | 'bookmaker'
  | 'tipster'
  | 'structure'
  | 'tag'
  | 'odds'
  | 'weekday'
  | 'month';

/** Where the money actually came from, cut by whichever dimension is selected. */
export default function Analytics() {
  const { t, formatMoney, formatPercent, formatNumber } = useI18n();
  const { settings, scopedBets, currency } = useApp();

  const [dimension, setDimension] = useState<Dimension>('sport');

  const stats = useMemo(() => computeStats(scopedBets), [scopedBets]);
  const rows = useMemo(
    () => breakdown(scopedBets, dimension, t),
    [scopedBets, dimension, t],
  );

  if (scopedBets.length === 0) {
    return (
      <View>
        <BankrollSwitcher />
        <Dim style={{ textAlign: 'center', paddingVertical: space.xxl }}>
          {t('analytics.noData')}
        </Dim>
      </View>
    );
  }

  return (
    <View>
      <BankrollSwitcher />

      <Panel title={t('analytics.overview')}>
        <StatGrid>
          <Stat
            label={t('stat.profit')}
            value={formatMoney(stats.profit, currency, { sign: true })}
            tone={stats.profit > 0 ? 'good' : stats.profit < 0 ? 'bad' : undefined}
          />
          <Stat label={t('stat.yield')} value={formatPercent(stats.yield)} />
          <Stat label={t('stat.hitRate')} value={formatPercent(stats.hitRate)} />
          <Stat label={t('stat.turnover')} value={formatMoney(stats.turnover, currency)} />
          <Stat label={t('stat.avgStake')} value={formatMoney(stats.avgStake, currency)} />
          <Stat
            label={t('stat.avgOdds')}
            value={formatOdds(stats.avgOdds, settings.oddsFormat)}
          />
          <Stat label={t('stat.profitFactor')} value={formatNumber(stats.profitFactor, {
            maximumFractionDigits: 2,
          })} />
          <Stat
            label={t('stat.maxDrawdown')}
            value={formatMoney(stats.maxDrawdown, currency)}
            sub={formatPercent(stats.maxDrawdownPct)}
          />
          <Stat
            label={t('stat.biggestWin')}
            value={formatMoney(stats.biggestWin, currency)}
            tone="good"
          />
          <Stat
            label={t('stat.biggestLoss')}
            value={formatMoney(stats.biggestLoss, currency)}
            tone="bad"
          />
          <Stat label={t('stat.longestWinStreak')} value={String(stats.longestWinStreak)} />
          <Stat label={t('stat.longestLossStreak')} value={String(stats.longestLossStreak)} />
        </StatGrid>
      </Panel>

      {stats.clvBetCount > 0 ? (
        <Panel title={t('clv.title')}>
          <Dim style={{ marginBottom: space.sm }}>{t('clv.explain')}</Dim>
          <StatGrid>
            <Stat
              label={t('clv.avgClv')}
              value={formatPercent(stats.avgClv)}
              tone={stats.avgClv > 0 ? 'good' : stats.avgClv < 0 ? 'bad' : undefined}
            />
            <Stat label={t('clv.positiveRate')} value={formatPercent(stats.positiveClvRate)} />
            <Stat label={t('clv.betCount')} value={String(stats.clvBetCount)} />
            <Stat label={t('clv.totalEv')} value={formatMoney(stats.totalEv, currency, { sign: true })} />
            <Stat
              label={t('clv.luck')}
              value={formatMoney(stats.luck, currency, { sign: true })}
              tone={stats.luck > 0 ? 'good' : stats.luck < 0 ? 'bad' : undefined}
            />
          </StatGrid>
        </Panel>
      ) : null}

      <Panel title={t('analytics.breakdown')}>
        <Chips
          compact
          value={dimension}
          onChange={setDimension}
          options={[
            { value: 'sport' as const, label: t('analytics.bySport') },
            { value: 'competition' as const, label: t('analytics.byCompetition') },
            { value: 'bookmaker' as const, label: t('analytics.byBookmaker') },
            { value: 'tipster' as const, label: t('analytics.byTipster') },
            { value: 'structure' as const, label: t('analytics.byStructure') },
            { value: 'tag' as const, label: t('analytics.byTag') },
            { value: 'odds' as const, label: t('analytics.byOdds') },
            { value: 'weekday' as const, label: t('analytics.byWeekday') },
            { value: 'month' as const, label: t('analytics.byMonth') },
          ]}
        />

        <View style={{ marginTop: space.md }}>
          {rows.length === 0 ? (
            <Dim>{t('analytics.noData')}</Dim>
          ) : (
            rows.map((row) => <BreakdownLine key={row.key} row={row} currency={currency} />)
          )}
        </View>
      </Panel>
    </View>
  );
}

function BreakdownLine({ row, currency }: { row: BreakdownRow; currency: string }) {
  const c = useColors();
  const { t, formatMoney, formatPercent } = useI18n();
  return (
    <View style={{ paddingVertical: space.sm, borderBottomWidth: 1, borderBottomColor: c.border }}>
      <Row>
        <Text numberOfLines={1} style={{ color: c.text, fontSize: font.sm,
                                         fontWeight: '600', flex: 1 }}>
          {row.label}
        </Text>
        <Text style={{ color: row.profit > 0 ? c.good : row.profit < 0 ? c.bad : c.textDim,
                       fontSize: font.sm, fontWeight: '700' }}>
          {formatMoney(row.profit, currency, { sign: true })}
        </Text>
      </Row>
      <Dim style={{ fontSize: font.xs, marginTop: 2 }}>
        {row.betCount} {t('bet.bets')} · {t('stat.hitRate')} {formatPercent(row.hitRate)} ·{' '}
        {t('stat.yield')} {formatPercent(row.yield)}
      </Dim>
    </View>
  );
}

/** Maps the selected dimension onto `breakdownBy`'s key function. */
function breakdown(
  bets: Bet[],
  dimension: Dimension,
  t: (key: never, params?: Record<string, string | number>) => string,
): BreakdownRow[] {
  switch (dimension) {
    case 'sport':
      return breakdownBy(
        bets,
        (b) => Array.from(new Set(b.selections.map((s) => s.sport))),
        (key) => t(`sport.${key}` as never),
      );
    case 'competition':
      return breakdownBy(bets, (b) =>
        Array.from(new Set(b.selections.map((s) => s.competition).filter(Boolean))),
      );
    case 'bookmaker':
      return breakdownBy(bets, (b) => b.bookmaker || t('common.unknown' as never));
    case 'tipster':
      return breakdownBy(bets, (b) => b.tipster || undefined);
    case 'structure':
      return breakdownBy(bets, (b) => b.structure, (key) =>
        t(`bet.structure.${key}` as never),
      );
    case 'tag':
      return breakdownBy(bets, (b) => b.tags);
    case 'odds':
      return breakdownBy(bets, (b) =>
        oddsBand(b.selections.reduce((acc, s) => acc * s.odds, 1)),
      );
    case 'weekday':
      return weekdayBreakdown(bets);
    case 'month':
      return monthlyBreakdown(bets);
  }
}
