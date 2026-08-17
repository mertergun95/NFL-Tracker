import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { font, space, useColors } from '../../lib/theme';
import { useI18n } from '../i18n';
import {
  dutching,
  hedge,
  marketRtp,
  stakeSuggestion,
  surebet,
  type StakingPlan,
} from '../core/calculators';
import {
  decimalToAmerican,
  decimalToFractional,
  formatOdds,
  impliedProbability,
  parseOdds,
} from '../core/odds';
import { useApp } from '../state/AppContext';
import { Button, Chips, Dim, Field, Input, NumberInput, Panel, Row } from '../ui';

type Tool = 'staking' | 'hedge' | 'dutching' | 'surebet' | 'rtp' | 'converter';

const PLANS: StakingPlan[] = [
  'flat',
  'percentage',
  'kelly',
  'fractionalKelly',
  'levelToWin',
  'martingale',
  'fibonacci',
  'dalembert',
];

/** The betting maths, one tool at a time so a phone screen stays readable. */
export default function Calculators() {
  const { t } = useI18n();
  const [tool, setTool] = useState<Tool>('staking');

  return (
    <View>
      <Chips
        compact
        value={tool}
        onChange={setTool}
        options={[
          { value: 'staking' as const, label: t('calc.staking') },
          { value: 'hedge' as const, label: t('calc.hedge') },
          { value: 'dutching' as const, label: t('calc.dutching') },
          { value: 'surebet' as const, label: t('calc.surebet') },
          { value: 'rtp' as const, label: t('calc.rtp') },
          { value: 'converter' as const, label: t('calc.converter') },
        ]}
      />

      <View style={{ marginTop: space.md }}>
        {tool === 'staking' ? <Staking /> : null}
        {tool === 'hedge' ? <Hedge /> : null}
        {tool === 'dutching' ? <Spread mode="dutching" /> : null}
        {tool === 'surebet' ? <Spread mode="surebet" /> : null}
        {tool === 'rtp' ? <Rtp /> : null}
        {tool === 'converter' ? <Converter /> : null}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * Staking
 * ------------------------------------------------------------------ */

function Staking() {
  const { t, formatMoney, formatPercent } = useI18n();
  const { currency, activeBankroll } = useApp();

  const [plan, setPlan] = useState<StakingPlan>('fractionalKelly');
  const [bankroll, setBankroll] = useState<number | undefined>(
    activeBankroll?.startingCapital || 1000,
  );
  const [odds, setOdds] = useState<number | undefined>(2);
  const [probability, setProbability] = useState<number | undefined>(55);
  const [unit, setUnit] = useState<number | undefined>(10);
  const [percent, setPercent] = useState<number | undefined>(2);
  const [kellyFraction, setKellyFraction] = useState<number | undefined>(0.25);
  const [lossStreak, setLossStreak] = useState<number | undefined>(0);
  const [targetProfit, setTargetProfit] = useState<number | undefined>(50);

  const result = useMemo(
    () =>
      stakeSuggestion({
        plan,
        bankroll: bankroll ?? 0,
        odds: odds ?? 0,
        // The field is a percentage because that is how people think about it;
        // the model wants a 0..1 probability.
        probability: probability === undefined ? undefined : probability / 100,
        unit,
        percent,
        kellyFraction,
        lossStreak,
        targetProfit,
      }),
    [plan, bankroll, odds, probability, unit, percent, kellyFraction, lossStreak, targetProfit],
  );

  const needsProbability = plan === 'kelly' || plan === 'fractionalKelly';
  const needsUnit = plan === 'flat' || plan === 'martingale' || plan === 'fibonacci'
    || plan === 'dalembert';

  return (
    <Panel title={t('calc.staking')}>
      <Dim>{t('calc.staking.desc')}</Dim>

      <Field label={t('calc.plan')}>
        <Chips
          compact
          value={plan}
          onChange={setPlan}
          options={PLANS.map((p) => ({ value: p, label: t(`calc.plan.${p}` as never) }))}
        />
      </Field>

      <Row gap={space.md}>
        <Field label={`${t('calc.bankroll')} (${currency})`} style={{ flex: 1 }}>
          <NumberInput value={bankroll} onChange={setBankroll} />
        </Field>
        <Field label={t('bet.odds')} style={{ flex: 1 }}>
          <NumberInput value={odds} onChange={setOdds} />
        </Field>
      </Row>

      {needsProbability ? (
        <Row gap={space.md}>
          <Field label={`${t('calc.probability')} %`} style={{ flex: 1 }}>
            <NumberInput value={probability} onChange={setProbability} />
          </Field>
          {plan === 'fractionalKelly' ? (
            <Field label={t('calc.kellyFraction')} style={{ flex: 1 }}>
              <NumberInput value={kellyFraction} onChange={setKellyFraction} />
            </Field>
          ) : null}
        </Row>
      ) : null}

      {plan === 'percentage' ? (
        <Field label={`${t('calc.percent')} %`}>
          <NumberInput value={percent} onChange={setPercent} />
        </Field>
      ) : null}

      {needsUnit ? (
        <Row gap={space.md}>
          <Field label={t('calc.unit')} style={{ flex: 1 }}>
            <NumberInput value={unit} onChange={setUnit} />
          </Field>
          <Field label={t('calc.lossStreak')} style={{ flex: 1 }}>
            <NumberInput decimals={false} value={lossStreak} onChange={setLossStreak} />
          </Field>
        </Row>
      ) : null}

      {plan === 'levelToWin' ? (
        <Field label={t('calc.targetProfit')}>
          <NumberInput value={targetProfit} onChange={setTargetProfit} />
        </Field>
      ) : null}

      <Results
        rows={[
          { label: t('calc.suggestedStake'), value: formatMoney(result.stake, currency), strong: true },
          { label: t('calc.bankrollFraction'), value: formatPercent(result.bankrollFraction) },
          {
            label: t('calc.edge'),
            value: formatPercent(result.edge),
            tone: result.edge > 0 ? 'good' : result.edge < 0 ? 'bad' : undefined,
          },
          {
            label: t('calc.expectedValue'),
            value: formatMoney(result.ev, currency, { sign: true }),
            tone: result.ev > 0 ? 'good' : result.ev < 0 ? 'bad' : undefined,
          },
        ]}
        warning={result.warning ? t(`calc.warning.${result.warning}` as never) : undefined}
      />
    </Panel>
  );
}

/* ------------------------------------------------------------------ *
 * Hedge
 * ------------------------------------------------------------------ */

function Hedge() {
  const { t, formatMoney } = useI18n();
  const { currency } = useApp();

  const [backStake, setBackStake] = useState<number | undefined>(100);
  const [backOdds, setBackOdds] = useState<number | undefined>(3);
  const [layOdds, setLayOdds] = useState<number | undefined>(2);
  const [commission, setCommission] = useState<number | undefined>(5);

  const result = useMemo(
    () =>
      hedge({
        backStake: backStake ?? 0,
        backOdds: backOdds ?? 0,
        layOdds: layOdds ?? 0,
        commission,
      }),
    [backStake, backOdds, layOdds, commission],
  );

  return (
    <Panel title={t('calc.hedge')}>
      <Dim>{t('calc.hedge.desc')}</Dim>

      <Row gap={space.md}>
        <Field label={t('calc.backStake')} style={{ flex: 1 }}>
          <NumberInput value={backStake} onChange={setBackStake} />
        </Field>
        <Field label={t('calc.backOdds')} style={{ flex: 1 }}>
          <NumberInput value={backOdds} onChange={setBackOdds} />
        </Field>
      </Row>
      <Row gap={space.md}>
        <Field label={t('calc.layOdds')} style={{ flex: 1 }}>
          <NumberInput value={layOdds} onChange={setLayOdds} />
        </Field>
        <Field label={`${t('bet.commission')} %`} style={{ flex: 1 }}>
          <NumberInput value={commission} onChange={setCommission} />
        </Field>
      </Row>

      <Results
        rows={[
          { label: t('calc.layStake'), value: formatMoney(result.layStake, currency), strong: true },
          { label: t('bet.liability'), value: formatMoney(result.liability, currency) },
          {
            label: t('calc.lockedProfit'),
            value: formatMoney(result.lockedProfit, currency, { sign: true }),
            tone: result.lockedProfit >= 0 ? 'good' : 'bad',
            strong: true,
          },
          { label: t('calc.ifWins'), value: formatMoney(result.profitIfWin, currency, { sign: true }) },
          { label: t('calc.ifLoses'), value: formatMoney(result.profitIfLose, currency, { sign: true }) },
          {
            label: t('calc.freeBetLay'),
            value: formatMoney(result.freeBetLayStake, currency),
          },
        ]}
      />
    </Panel>
  );
}

/* ------------------------------------------------------------------ *
 * Dutching / surebet — same maths, different framing
 * ------------------------------------------------------------------ */

function Spread({ mode }: { mode: 'dutching' | 'surebet' }) {
  const c = useColors();
  const { t, formatMoney, formatPercent } = useI18n();
  const { currency } = useApp();

  const [odds, setOdds] = useState<(number | undefined)[]>([2.1, 2.1]);
  const [totalStake, setTotalStake] = useState<number | undefined>(100);

  const legs = odds.map((o) => ({ odds: o ?? 0 }));
  const result = useMemo(
    () =>
      mode === 'surebet'
        ? surebet(legs, totalStake ?? 0)
        : dutching(legs, totalStake ?? 0),
    // `legs` is rebuilt every render; the odds array is what actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, odds, totalStake],
  );

  return (
    <Panel title={mode === 'surebet' ? t('calc.surebet') : t('calc.dutching')}>
      <Dim>{mode === 'surebet' ? t('calc.surebet.desc') : t('calc.dutching.desc')}</Dim>

      <Field label={t('calc.totalStake')}>
        <NumberInput value={totalStake} onChange={setTotalStake} />
      </Field>

      {odds.map((value, i) => (
        <Field key={i} label={`${t('calc.outcome')} ${i + 1}`}>
          <Row gap={space.sm}>
            <NumberInput
              value={value}
              onChange={(v) => setOdds((prev) => prev.map((x, j) => (j === i ? v : x)))}
              style={{ flex: 1 }}
            />
            <Text style={{ color: c.text, fontSize: font.sm, width: 92, textAlign: 'right' }}>
              {formatMoney(result.stakes[i] ?? 0, currency)}
            </Text>
            {odds.length > 2 ? (
              <Pressable
                onPress={() => setOdds((prev) => prev.filter((_, j) => j !== i))}
                hitSlop={10}
              >
                <Text style={{ color: c.bad, fontSize: font.lg }}>✕</Text>
              </Pressable>
            ) : null}
          </Row>
        </Field>
      ))}

      <Button
        label={t('calc.addOutcome')}
        tone="ghost"
        onPress={() => setOdds((prev) => [...prev, undefined])}
        style={{ marginTop: space.md }}
      />

      <Results
        rows={[
          {
            label: t('calc.guaranteedProfit'),
            value: formatMoney(result.profit, currency, { sign: true }),
            tone: result.profit > 0 ? 'good' : result.profit < 0 ? 'bad' : undefined,
            strong: true,
          },
          { label: t('calc.overround'), value: formatPercent(result.overround - 1) },
          { label: 'ROI', value: formatPercent(result.roi) },
          {
            label: result.isArb ? t('calc.isArb') : t('calc.noArb'),
            value: mode === 'surebet' ? formatPercent((result as ReturnType<typeof surebet>).edge) : '',
            tone: result.isArb ? 'good' : 'bad',
          },
        ]}
      />
    </Panel>
  );
}

/* ------------------------------------------------------------------ *
 * Market RTP
 * ------------------------------------------------------------------ */

function Rtp() {
  const c = useColors();
  const { t, formatPercent, formatNumber } = useI18n();

  const [odds, setOdds] = useState<(number | undefined)[]>([2.1, 3.4, 3.6]);
  const result = useMemo(() => marketRtp(odds.map((o) => o ?? 0)), [odds]);

  return (
    <Panel title={t('calc.rtp')}>
      <Dim>{t('calc.rtp.desc')}</Dim>

      {odds.map((value, i) => (
        <Field key={i} label={`${t('calc.outcome')} ${i + 1}`}>
          <Row gap={space.sm}>
            <NumberInput
              value={value}
              onChange={(v) => setOdds((prev) => prev.map((x, j) => (j === i ? v : x)))}
              style={{ flex: 1 }}
            />
            <Text style={{ color: c.textDim, fontSize: font.sm, width: 92, textAlign: 'right' }}>
              {t('calc.fairOdds')} {formatNumber(result.fairOdds[i] ?? 0, {
                maximumFractionDigits: 2,
              })}
            </Text>
            {odds.length > 2 ? (
              <Pressable
                onPress={() => setOdds((prev) => prev.filter((_, j) => j !== i))}
                hitSlop={10}
              >
                <Text style={{ color: c.bad, fontSize: font.lg }}>✕</Text>
              </Pressable>
            ) : null}
          </Row>
        </Field>
      ))}

      <Button
        label={t('calc.addOutcome')}
        tone="ghost"
        onPress={() => setOdds((prev) => [...prev, undefined])}
        style={{ marginTop: space.md }}
      />

      <Results
        rows={[
          { label: 'RTP', value: formatPercent(result.rtp), strong: true },
          { label: t('calc.margin'), value: formatPercent(result.margin) },
          { label: t('calc.overround'), value: formatPercent(result.overround - 1) },
        ]}
      />
    </Panel>
  );
}

/* ------------------------------------------------------------------ *
 * Odds converter
 * ------------------------------------------------------------------ */

function Converter() {
  const { t, formatPercent, formatNumber } = useI18n();
  const [text, setText] = useState('2.50');

  const decimal = parseOdds(text.replace(',', '.')) ?? 0;
  const valid = decimal > 1;
  const [num, den] = valid ? decimalToFractional(decimal) : [0, 1];

  return (
    <Panel title={t('calc.converter')}>
      <Dim>{t('calc.converter.desc')}</Dim>

      {/* Free text rather than a number pad: the converter's whole point is
          that it accepts decimal, American and fractional notation. */}
      <Field label={t('bet.odds')} hint="2.50 · +150 · 3/2">
        <Input value={text} onChange={setText} autoCapitalize="none" placeholder="2.50" />
      </Field>

      <Results
        rows={[
          {
            label: t('calc.decimal'),
            value: valid ? formatOdds(decimal, 'decimal') : '—',
            strong: true,
          },
          {
            label: t('calc.american'),
            value: valid ? String(decimalToAmerican(decimal)) : '—',
          },
          { label: t('calc.fractional'), value: valid ? `${num}/${den}` : '—' },
          {
            label: t('calc.impliedProbability'),
            value: valid ? formatPercent(impliedProbability(decimal)) : '—',
          },
          {
            label: t('calc.fairOdds'),
            value: valid
              ? formatNumber(1 / impliedProbability(decimal), { maximumFractionDigits: 2 })
              : '—',
          },
        ]}
      />
    </Panel>
  );
}

/* ------------------------------------------------------------------ *
 * Shared read-out
 * ------------------------------------------------------------------ */

function Results({
  rows,
  warning,
}: {
  rows: { label: string; value: string; tone?: 'good' | 'bad'; strong?: boolean }[];
  warning?: string;
}) {
  const c = useColors();
  return (
    <View style={{ marginTop: space.lg, borderTopWidth: 1, borderTopColor: c.border,
                   paddingTop: space.sm }}>
      {rows.map((row) => (
        <Row key={row.label} style={{ paddingVertical: 5 }}>
          <Text style={{ color: c.textDim, fontSize: font.sm, flex: 1 }}>{row.label}</Text>
          <Text
            style={{
              color: row.tone === 'good' ? c.good : row.tone === 'bad' ? c.bad : c.text,
              fontSize: row.strong ? font.lg : font.md,
              fontWeight: row.strong ? '700' : '600',
            }}
          >
            {row.value}
          </Text>
        </Row>
      ))}
      {warning ? (
        <Text style={{ color: c.warn, fontSize: font.sm, marginTop: space.sm }}>{warning}</Text>
      ) : null}
    </View>
  );
}
