import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { font, radius, space, useColors } from '../../lib/theme';
import { useI18n } from '../i18n';
import { BANKROLL_COLORS, CURRENCIES, SPORTS, sportIcon } from '../core/reference';
import { computeStats } from '../core/stats';
import type { Bankroll, TransactionKind } from '../core/types';
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
  Picker,
  Row,
  Sheet,
  Toggle,
} from '../ui';

const KINDS: TransactionKind[] = ['deposit', 'withdrawal', 'adjustment', 'bonus'];

/** Bankrolls, their balances, and the money moving in and out of them. */
export default function Bankrolls() {
  const { t } = useI18n();
  const { bankrolls, bets, transactions } = useApp();

  const [editing, setEditing] = useState<Bankroll | 'new' | null>(null);
  const [moneyFor, setMoneyFor] = useState<Bankroll | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const visible = bankrolls.filter((b) => showArchived || !b.archived);

  return (
    <View>
      <Row style={{ marginBottom: space.md }}>
        <View style={{ flex: 1 }}>
          <Toggle
            label={t('bankroll.showArchived')}
            value={showArchived}
            onChange={setShowArchived}
          />
        </View>
      </Row>

      <Button label={t('bankroll.new')} onPress={() => setEditing('new')}
              style={{ marginBottom: space.md }} />

      {visible.length === 0 ? (
        <Dim style={{ textAlign: 'center', paddingVertical: space.xxl }}>
          {t('bankroll.empty')}
        </Dim>
      ) : (
        visible.map((bankroll) => (
          <BankrollCard
            key={bankroll.id}
            bankroll={bankroll}
            bets={bets.filter((b) => b.bankrollId === bankroll.id)}
            transactions={transactions.filter((x) => x.bankrollId === bankroll.id)}
            onEdit={() => setEditing(bankroll)}
            onMoney={() => setMoneyFor(bankroll)}
          />
        ))
      )}

      {editing ? (
        <BankrollEditor
          bankroll={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}

      {moneyFor ? (
        <TransactionEditor bankroll={moneyFor} onClose={() => setMoneyFor(null)} />
      ) : null}
    </View>
  );
}

function BankrollCard({
  bankroll,
  bets,
  transactions,
  onEdit,
  onMoney,
}: {
  bankroll: Bankroll;
  bets: ReturnType<typeof useApp>['bets'];
  transactions: ReturnType<typeof useApp>['transactions'];
  onEdit: () => void;
  onMoney: () => void;
}) {
  const c = useColors();
  const { t, formatMoney, formatDate, formatPercent } = useI18n();
  const { deleteTransaction } = useApp();

  const stats = useMemo(() => computeStats(bets), [bets]);
  const cash = transactions.reduce((sum, x) => sum + x.amount, 0);
  const balance = bankroll.startingCapital + cash + stats.profit;

  return (
    <Panel
      title={bankroll.name}
      action={
        <Row gap={space.sm}>
          <Button label={t('tx.new')} tone="ghost" onPress={onMoney} />
          <Button label={t('action.edit')} tone="ghost" onPress={onEdit} />
        </Row>
      }
    >
      <Row gap={space.sm}>
        <View style={{ width: 10, height: 10, borderRadius: 5,
                       backgroundColor: bankroll.color }} />
        <Dim>{bankroll.currency}</Dim>
        {bankroll.archived ? <Dim>· {t('bankroll.archived')}</Dim> : null}
      </Row>

      <Row gap={space.lg} style={{ marginTop: space.md, flexWrap: 'wrap' }}>
        <Figure label={t('bankroll.currentBalance')} value={formatMoney(balance, bankroll.currency)} />
        <Figure
          label={t('dash.profit')}
          value={formatMoney(stats.profit, bankroll.currency, { sign: true })}
          tone={stats.profit > 0 ? 'good' : stats.profit < 0 ? 'bad' : undefined}
        />
        <Figure label={t('dash.yield')} value={formatPercent(stats.yield)} />
        <Figure label={t('bet.bets')} value={String(stats.betCount)} />
      </Row>

      {bankroll.sports.length > 0 ? (
        <Dim style={{ marginTop: space.sm }}>
          {bankroll.sports.map((s) => sportIcon(s)).join(' ')}
        </Dim>
      ) : null}

      {bankroll.note ? <Dim style={{ marginTop: space.sm }}>{bankroll.note}</Dim> : null}

      {transactions.length > 0 ? (
        <>
          <Divider />
          <Text style={{ color: c.textDim, fontSize: font.xs, marginBottom: space.xs }}>
            {t('tx.title')}
          </Text>
          {transactions.slice(-5).reverse().map((tx) => (
            <Row key={tx.id} style={{ paddingVertical: 5 }}>
              <Text style={{ color: c.text, fontSize: font.sm, flex: 1 }}>
                {t(`tx.${tx.kind}` as never)}
              </Text>
              <Text style={{ color: c.textDim, fontSize: font.xs, marginRight: space.sm }}>
                {formatDate(tx.occurredAt)}
              </Text>
              <Text style={{ color: tx.amount >= 0 ? c.good : c.bad, fontSize: font.sm,
                             fontWeight: '600' }}>
                {formatMoney(tx.amount, bankroll.currency, { sign: true })}
              </Text>
              <Pressable onPress={() => void deleteTransaction(tx.id)} hitSlop={10}
                         style={{ marginLeft: space.sm }}>
                <Text style={{ color: c.textDim }}>✕</Text>
              </Pressable>
            </Row>
          ))}
        </>
      ) : null}
    </Panel>
  );
}

function Figure({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
  const c = useColors();
  const color = tone === 'good' ? c.good : tone === 'bad' ? c.bad : c.text;
  return (
    <View>
      <Text style={{ color: c.textDim, fontSize: font.xs }}>{label}</Text>
      <Text style={{ color, fontSize: font.lg, fontWeight: '700' }}>{value}</Text>
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * Editors
 * ------------------------------------------------------------------ */

function BankrollEditor({
  bankroll,
  onClose,
}: {
  bankroll: Bankroll | null;
  onClose: () => void;
}) {
  const c = useColors();
  const { t } = useI18n();
  const { saveBankroll, deleteBankroll } = useApp();

  const [name, setName] = useState(bankroll?.name ?? '');
  const [currency, setCurrency] = useState(bankroll?.currency ?? 'TRY');
  const [startingCapital, setStartingCapital] = useState<number | undefined>(
    bankroll?.startingCapital,
  );
  const [defaultStake, setDefaultStake] = useState<number | undefined>(bankroll?.defaultStake);
  const [note, setNote] = useState(bankroll?.note ?? '');
  const [color, setColor] = useState(bankroll?.color ?? BANKROLL_COLORS[0]!);
  const [sports, setSports] = useState<string[]>(bankroll?.sports ?? []);
  const [archived, setArchived] = useState(bankroll?.archived ?? false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  async function onSave() {
    if (!name.trim()) {
      setError(t('bankroll.nameRequired'));
      return;
    }
    await saveBankroll({
      id: bankroll?.id,
      name: name.trim(),
      currency,
      startingCapital: startingCapital ?? 0,
      defaultStake: defaultStake ?? 0,
      note,
      color,
      sports,
      archived,
    });
    onClose();
  }

  return (
    <Sheet open onClose={onClose} title={bankroll ? t('bankroll.edit') : t('bankroll.new')}>
      <View style={{ maxHeight: 460 }}>
        <Field label={t('bankroll.name')}>
          <Input value={name} onChange={setName} />
        </Field>

        <Row gap={space.md}>
          <Field label={t('common.currency')} style={{ flex: 1 }}>
            <Picker
              value={currency}
              options={CURRENCIES.map((x) => ({ value: x.code, label: `${x.symbol} ${x.code}` }))}
              onChange={setCurrency}
              title={t('common.currency')}
            />
          </Field>
          <Field label={t('bankroll.startingCapital')} style={{ flex: 1 }}>
            <NumberInput value={startingCapital} onChange={setStartingCapital} placeholder="0" />
          </Field>
        </Row>

        <Field label={t('bankroll.defaultStake')} hint={t('common.optional')}>
          <NumberInput value={defaultStake} onChange={setDefaultStake} placeholder="0" />
        </Field>

        <Field label={t('common.color')}>
          <Row gap={space.sm} style={{ flexWrap: 'wrap' }}>
            {BANKROLL_COLORS.map((x) => (
              <Pressable
                key={x}
                onPress={() => setColor(x)}
                style={{
                  width: 30, height: 30, borderRadius: radius.sm, backgroundColor: x,
                  borderWidth: x === color ? 3 : 0, borderColor: c.text,
                }}
              />
            ))}
          </Row>
        </Field>

        <Field label={t('bankroll.sports')} hint={t('bankroll.sports.hint')}>
          <Row gap={space.xs} style={{ flexWrap: 'wrap' }}>
            {SPORTS.map((s) => {
              const on = sports.includes(s.key);
              return (
                <Pressable
                  key={s.key}
                  onPress={() =>
                    setSports((prev) =>
                      on ? prev.filter((x) => x !== s.key) : [...prev, s.key],
                    )
                  }
                  style={{
                    paddingHorizontal: space.sm, paddingVertical: 4, borderRadius: radius.pill,
                    borderWidth: 1, borderColor: on ? c.accent : c.border,
                    backgroundColor: on ? c.accent : 'transparent',
                  }}
                >
                  <Text style={{ fontSize: font.xs, color: on ? c.accentText : c.text }}>
                    {sportIcon(s.key)} {t(`sport.${s.key}` as never)}
                  </Text>
                </Pressable>
              );
            })}
          </Row>
        </Field>

        <Field label={t('bankroll.notepad')} hint={t('bankroll.notepad.hint')}>
          <Input value={note} onChange={setNote} multiline />
        </Field>

        {bankroll ? (
          <Toggle label={t('bankroll.archive')} value={archived} onChange={setArchived} />
        ) : null}

        {error ? (
          <Text style={{ color: c.bad, fontSize: font.sm, marginTop: space.sm }}>{error}</Text>
        ) : null}
      </View>

      <Row gap={space.md} style={{ marginTop: space.lg }}>
        <Button label={t('action.cancel')} tone="ghost" onPress={onClose} style={{ flex: 1 }} />
        <Button label={t('action.save')} onPress={onSave} style={{ flex: 1 }} />
      </Row>

      {bankroll ? (
        <Button
          label={t('action.delete')}
          tone="danger"
          onPress={() => setDeleting(true)}
          style={{ marginTop: space.md }}
        />
      ) : null}

      <Confirm
        open={deleting}
        title={t('action.delete')}
        message={t('bankroll.deleteConfirm')}
        confirmLabel={t('action.delete')}
        cancelLabel={t('action.cancel')}
        onCancel={() => setDeleting(false)}
        onConfirm={() => {
          if (bankroll) void deleteBankroll(bankroll.id);
          setDeleting(false);
          onClose();
        }}
      />
    </Sheet>
  );
}

function TransactionEditor({
  bankroll,
  onClose,
}: {
  bankroll: Bankroll;
  onClose: () => void;
}) {
  const c = useColors();
  const { t } = useI18n();
  const { saveTransaction } = useApp();

  const [kind, setKind] = useState<TransactionKind>('deposit');
  const [amount, setAmount] = useState<number | undefined>();
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  async function onSave() {
    if (!amount || amount === 0) {
      setError(t('tx.amountRequired'));
      return;
    }
    // Withdrawals are stored as negative movements so the balance is a plain
    // sum, with no per-kind sign handling anywhere downstream.
    const signed = kind === 'withdrawal' ? -Math.abs(amount) : amount;
    await saveTransaction({
      bankrollId: bankroll.id,
      kind,
      amount: signed,
      note,
      occurredAt: Date.now(),
      updatedAt: Date.now(),
    });
    onClose();
  }

  return (
    <Sheet open onClose={onClose} title={t('tx.new')}>
      <Field label={t('tx.kind')}>
        <Chips
          compact
          value={kind}
          onChange={setKind}
          options={KINDS.map((k) => ({ value: k, label: t(`tx.${k}` as never) }))}
        />
      </Field>

      <Field label={`${t('common.amount')} (${bankroll.currency})`}>
        <NumberInput value={amount} onChange={setAmount} placeholder="0" />
      </Field>

      <Field label={t('common.notes')} hint={t('common.optional')}>
        <Input value={note} onChange={setNote} />
      </Field>

      {error ? (
        <Text style={{ color: c.bad, fontSize: font.sm, marginTop: space.sm }}>{error}</Text>
      ) : null}

      <Row gap={space.md} style={{ marginTop: space.lg }}>
        <Button label={t('action.cancel')} tone="ghost" onPress={onClose} style={{ flex: 1 }} />
        <Button label={t('action.save')} onPress={onSave} style={{ flex: 1 }} />
      </Row>
    </Sheet>
  );
}
