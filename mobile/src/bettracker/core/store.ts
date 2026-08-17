import AsyncStorage from '@react-native-async-storage/async-storage';
import { newId } from './ids';
import { DEFAULT_BOOKMAKERS } from './reference';
import { isSettled, settleBet } from './settlement';
import type {
  Bankroll,
  Bet,
  BetFilter,
  Settings,
  Tombstone,
  Transaction,
} from './types';

/**
 * Data access on the phone.
 *
 * This is the React Native counterpart of the web module's IndexedDB store and
 * implements the same `DataStore` interface, so everything above it — the
 * screens, the statistics, and the whole sync service — is shared code that
 * neither knows nor cares which one it is talking to.
 *
 * The whole dataset lives in one AsyncStorage document per table, read once at
 * startup and kept in memory. AsyncStorage has no indexes and no transactions,
 * so per-record keys would mean N round trips for a list and no way to keep a
 * multi-table delete atomic. A personal betting history is a few hundred
 * kilobytes of JSON; loading it whole is both simpler and faster, and it makes
 * the in-memory copy the single source of truth that writes are flushed from.
 */
export interface DataStore {
  listBankrolls(includeArchived?: boolean): Promise<Bankroll[]>;
  getBankroll(id: string): Promise<Bankroll | undefined>;
  saveBankroll(input: Partial<Bankroll> & { name: string }): Promise<Bankroll>;
  updateBankroll(id: string, patch: Partial<Bankroll>): Promise<void>;
  deleteBankroll(id: string): Promise<void>;

  listBets(filter?: BetFilter): Promise<Bet[]>;
  getBet(id: string): Promise<Bet | undefined>;
  saveBet(input: Omit<Bet, 'createdAt' | 'updatedAt'> & Partial<Pick<Bet, 'createdAt'>>): Promise<Bet>;
  updateBets(ids: string[], patch: Partial<Bet>): Promise<void>;
  deleteBets(ids: string[]): Promise<void>;

  listTransactions(bankrollId?: string): Promise<Transaction[]>;
  saveTransaction(input: Omit<Transaction, 'id' | 'createdAt'> & { id?: string }): Promise<Transaction>;
  deleteTransaction(id: string): Promise<void>;

  getSettings(): Promise<Settings>;
  updateSettings(patch: Partial<Settings>): Promise<Settings>;

  /** Deletion records, so a sync does not resurrect what another device removed. */
  listTombstones(): Promise<Tombstone[]>;
  putTombstones(tombstones: Tombstone[]): Promise<void>;

  /** Writes a record without touching `updatedAt`. Used by the sync merger. */
  putRaw(data: { bankrolls?: Bankroll[]; bets?: Bet[]; transactions?: Transaction[] }): Promise<void>;

  /** Wipes every table. Used by "reset app" and before restoring a backup. */
  clearAll(): Promise<void>;
}

const KEYS = {
  bankrolls: 'bettracker.bankrolls',
  bets: 'bettracker.bets',
  transactions: 'bettracker.transactions',
  settings: 'bettracker.settings',
  tombstones: 'bettracker.tombstones',
} as const;

const DEFAULT_SETTINGS: Settings = {
  id: 'settings',
  language: 'tr',
  theme: 'system',
  oddsFormat: 'decimal',
  bookmakers: DEFAULT_BOOKMAKERS.map((b) => b.name),
  tipsters: [],
  defaultCommission: 0,
  defaultBookmaker: 'Stake',
  sidebarPinned: false,
  updatedAt: 0,
};

interface Snapshot {
  bankrolls: Bankroll[];
  bets: Bet[];
  transactions: Transaction[];
  tombstones: Tombstone[];
  settings: Settings;
}

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    // A corrupt document must not brick the app on launch. Losing one table is
    // recoverable from a backup; a permanent crash loop is not.
    return fallback;
  }
}

class AsyncStorageStore implements DataStore {
  /**
   * Loaded once and shared by every caller. Held as a promise so that the many
   * reads the first render fires off all await the same load.
   */
  private snapshot: Promise<Snapshot> | null = null;

  /**
   * Serialises writes. Two callers flushing the same table concurrently would
   * otherwise race, and the loser's records would vanish.
   */
  private queue: Promise<unknown> = Promise.resolve();

  private load(): Promise<Snapshot> {
    this.snapshot ??= (async () => {
      const [bankrolls, bets, transactions, tombstones, settings] = await Promise.all([
        readJson<Bankroll[]>(KEYS.bankrolls, []),
        readJson<Bet[]>(KEYS.bets, []),
        readJson<Transaction[]>(KEYS.transactions, []),
        readJson<Tombstone[]>(KEYS.tombstones, []),
        readJson<Settings | null>(KEYS.settings, null),
      ]);
      return {
        bankrolls,
        bets,
        transactions,
        tombstones,
        settings: settings ? { ...DEFAULT_SETTINGS, ...settings } : { ...DEFAULT_SETTINGS },
      };
    })();
    return this.snapshot;
  }

  /** Runs `mutate` against the in-memory snapshot, then persists the tables it touched. */
  private write<T>(
    tables: (keyof typeof KEYS)[],
    mutate: (snapshot: Snapshot) => T | Promise<T>,
  ): Promise<T> {
    const run = async (): Promise<T> => {
      const snapshot = await this.load();
      const result = await mutate(snapshot);
      await AsyncStorage.multiSet(
        tables.map((table) => [KEYS[table], JSON.stringify(snapshot[table])]),
      );
      return result;
    };

    const next = this.queue.then(run, run);
    // Keep the chain alive after a rejection, or every later write inherits it.
    this.queue = next.catch(() => undefined);
    return next;
  }

  /* ---------------- Bankrolls ---------------- */

  async listBankrolls(includeArchived = false): Promise<Bankroll[]> {
    const { bankrolls } = await this.load();
    return bankrolls
      .filter((b) => includeArchived || !b.archived)
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  async getBankroll(id: string): Promise<Bankroll | undefined> {
    const { bankrolls } = await this.load();
    return bankrolls.find((b) => b.id === id);
  }

  saveBankroll(input: Partial<Bankroll> & { name: string }): Promise<Bankroll> {
    return this.write(['bankrolls'], (snapshot) => {
      const now = Date.now();
      const existing = input.id ? snapshot.bankrolls.find((b) => b.id === input.id) : undefined;
      const bankroll: Bankroll = {
        id: input.id ?? newId('bk_'),
        name: input.name,
        currency: input.currency ?? existing?.currency ?? 'TRY',
        sports: input.sports ?? existing?.sports ?? [],
        startingCapital: input.startingCapital ?? existing?.startingCapital ?? 0,
        defaultStake: input.defaultStake ?? existing?.defaultStake ?? 0,
        note: input.note ?? existing?.note ?? '',
        color: input.color ?? existing?.color ?? '#3b82f6',
        archived: input.archived ?? existing?.archived ?? false,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      snapshot.bankrolls = upsert(snapshot.bankrolls, bankroll);
      return bankroll;
    });
  }

  updateBankroll(id: string, patch: Partial<Bankroll>): Promise<void> {
    return this.write(['bankrolls'], (snapshot) => {
      const existing = snapshot.bankrolls.find((b) => b.id === id);
      if (!existing) return;
      snapshot.bankrolls = upsert(snapshot.bankrolls, {
        ...existing,
        ...patch,
        id,
        updatedAt: Date.now(),
      });
    });
  }

  deleteBankroll(id: string): Promise<void> {
    // Bets and transactions are meaningless without their bankroll, so they go
    // with it rather than being orphaned.
    return this.write(['bankrolls', 'bets', 'transactions', 'tombstones'], (snapshot) => {
      const betIds = snapshot.bets.filter((b) => b.bankrollId === id).map((b) => b.id);
      const txIds = snapshot.transactions.filter((t) => t.bankrollId === id).map((t) => t.id);

      snapshot.bets = snapshot.bets.filter((b) => b.bankrollId !== id);
      snapshot.transactions = snapshot.transactions.filter((t) => t.bankrollId !== id);
      snapshot.bankrolls = snapshot.bankrolls.filter((b) => b.id !== id);

      snapshot.tombstones = mergeTombstones(snapshot.tombstones, [
        tombstone('bankroll', id),
        ...betIds.map((betId) => tombstone('bet', betId)),
        ...txIds.map((txId) => tombstone('transaction', txId)),
      ]);
    });
  }

  /* ---------------- Bets ---------------- */

  async listBets(filter: BetFilter = {}): Promise<Bet[]> {
    const { bets } = await this.load();
    return applyFilter(bets, filter).sort((a, b) => b.placedAt - a.placedAt);
  }

  async getBet(id: string): Promise<Bet | undefined> {
    const { bets } = await this.load();
    return bets.find((b) => b.id === id);
  }

  saveBet(
    input: Omit<Bet, 'createdAt' | 'updatedAt'> & Partial<Pick<Bet, 'createdAt'>>,
  ): Promise<Bet> {
    return this.write(['bets'], (snapshot) => {
      const now = Date.now();
      const existing = snapshot.bets.find((b) => b.id === input.id);
      const settledNow = isSettled(input as Bet);

      const bet: Bet = {
        ...(input as Bet),
        // Stamp the settlement time the first time a bet becomes settled, so the
        // equity curve orders bets by when they actually resolved.
        settledAt: input.settledAt ?? (settledNow ? (existing?.settledAt ?? now) : undefined),
        createdAt: input.createdAt ?? existing?.createdAt ?? now,
        updatedAt: now,
      };
      snapshot.bets = upsert(snapshot.bets, bet);
      return bet;
    });
  }

  updateBets(ids: string[], patch: Partial<Bet>): Promise<void> {
    if (ids.length === 0) return Promise.resolve();
    return this.write(['bets'], (snapshot) => {
      const now = Date.now();
      const wanted = new Set(ids);
      snapshot.bets = snapshot.bets.map((existing) => {
        if (!wanted.has(existing.id)) return existing;
        const merged: Bet = { ...existing, ...patch, id: existing.id, updatedAt: now };
        if (merged.settledAt === undefined && isSettled(merged)) merged.settledAt = now;
        return merged;
      });
    });
  }

  deleteBets(ids: string[]): Promise<void> {
    if (ids.length === 0) return Promise.resolve();
    return this.write(['bets', 'tombstones'], (snapshot) => {
      const doomed = new Set(ids);
      snapshot.bets = snapshot.bets.filter((b) => !doomed.has(b.id));
      snapshot.tombstones = mergeTombstones(
        snapshot.tombstones,
        ids.map((id) => tombstone('bet', id)),
      );
    });
  }

  /* ---------------- Transactions ---------------- */

  async listTransactions(bankrollId?: string): Promise<Transaction[]> {
    const { transactions } = await this.load();
    return transactions
      .filter((t) => !bankrollId || t.bankrollId === bankrollId)
      .sort((a, b) => a.occurredAt - b.occurredAt);
  }

  saveTransaction(
    input: Omit<Transaction, 'id' | 'createdAt'> & { id?: string },
  ): Promise<Transaction> {
    return this.write(['transactions'], (snapshot) => {
      const now = Date.now();
      const existing = input.id
        ? snapshot.transactions.find((t) => t.id === input.id)
        : undefined;
      const tx: Transaction = {
        ...input,
        id: input.id ?? newId('tx_'),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      snapshot.transactions = upsert(snapshot.transactions, tx);
      return tx;
    });
  }

  deleteTransaction(id: string): Promise<void> {
    return this.write(['transactions', 'tombstones'], (snapshot) => {
      snapshot.transactions = snapshot.transactions.filter((t) => t.id !== id);
      snapshot.tombstones = mergeTombstones(snapshot.tombstones, [
        tombstone('transaction', id),
      ]);
    });
  }

  async listTombstones(): Promise<Tombstone[]> {
    const { tombstones } = await this.load();
    return tombstones;
  }

  putTombstones(tombstones: Tombstone[]): Promise<void> {
    if (tombstones.length === 0) return Promise.resolve();
    return this.write(['tombstones'], (snapshot) => {
      snapshot.tombstones = mergeTombstones(snapshot.tombstones, tombstones);
    });
  }

  putRaw(data: {
    bankrolls?: Bankroll[];
    bets?: Bet[];
    transactions?: Transaction[];
  }): Promise<void> {
    return this.write(['bankrolls', 'bets', 'transactions'], (snapshot) => {
      if (data.bankrolls?.length) snapshot.bankrolls = upsertAll(snapshot.bankrolls, data.bankrolls);
      if (data.bets?.length) snapshot.bets = upsertAll(snapshot.bets, data.bets);
      if (data.transactions?.length) {
        snapshot.transactions = upsertAll(snapshot.transactions, data.transactions);
      }
    });
  }

  /* ---------------- Settings ---------------- */

  async getSettings(): Promise<Settings> {
    const { settings } = await this.load();
    return settings;
  }

  updateSettings(patch: Partial<Settings>): Promise<Settings> {
    return this.write(['settings'], (snapshot) => {
      snapshot.settings = {
        ...snapshot.settings,
        ...patch,
        id: 'settings',
        updatedAt: Date.now(),
      };
      return snapshot.settings;
    });
  }

  clearAll(): Promise<void> {
    return this.write(
      ['bankrolls', 'bets', 'transactions', 'settings', 'tombstones'],
      (snapshot) => {
        snapshot.bankrolls = [];
        snapshot.bets = [];
        snapshot.transactions = [];
        snapshot.tombstones = [];
        snapshot.settings = { ...DEFAULT_SETTINGS, updatedAt: Date.now() };
      },
    );
  }
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

function upsert<T extends { id: string }>(rows: T[], row: T): T[] {
  const index = rows.findIndex((r) => r.id === row.id);
  if (index === -1) return [...rows, row];
  const next = rows.slice();
  next[index] = row;
  return next;
}

function upsertAll<T extends { id: string }>(rows: T[], incoming: T[]): T[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  for (const row of incoming) byId.set(row.id, row);
  return Array.from(byId.values());
}

function tombstone(kind: Tombstone['kind'], recordId: string): Tombstone {
  return { id: `${kind}:${recordId}`, kind, recordId, deletedAt: Date.now() };
}

function mergeTombstones(existing: Tombstone[], incoming: Tombstone[]): Tombstone[] {
  return upsertAll(existing, incoming);
}

/* ------------------------------------------------------------------ *
 * Filtering
 * ------------------------------------------------------------------ */

/**
 * Applies a `BetFilter` in memory. Exported because the UI re-filters an
 * already-loaded list as the user changes a chip, without another store round trip.
 */
export function applyFilter(bets: Bet[], filter: BetFilter): Bet[] {
  const search = filter.search?.trim().toLowerCase();

  return bets.filter((bet) => {
    if (filter.bankrollIds?.length && !filter.bankrollIds.includes(bet.bankrollId)) return false;
    if (filter.from !== undefined && bet.placedAt < filter.from) return false;
    if (filter.to !== undefined && bet.placedAt > filter.to) return false;
    if (filter.bookmakers?.length && !filter.bookmakers.includes(bet.bookmaker)) return false;
    if (filter.structures?.length && !filter.structures.includes(bet.structure)) return false;
    if (filter.tipsters?.length && !filter.tipsters.includes(bet.tipster ?? '')) return false;
    if (filter.tags?.length && !filter.tags.some((t) => bet.tags.includes(t))) return false;

    if (filter.sports?.length && !bet.selections.some((s) => filter.sports!.includes(s.sport))) {
      return false;
    }
    if (
      filter.competitions?.length &&
      !bet.selections.some((s) => filter.competitions!.includes(s.competition))
    ) {
      return false;
    }
    if (filter.sides?.length && !bet.selections.some((s) => filter.sides!.includes(s.side))) {
      return false;
    }

    const settlement = settleBet(bet);
    if (filter.statuses?.length && !filter.statuses.includes(settlement.status)) return false;

    if (filter.minStake !== undefined && settlement.totalStake < filter.minStake) return false;
    if (filter.maxStake !== undefined && settlement.totalStake > filter.maxStake) return false;

    if (filter.minOdds !== undefined || filter.maxOdds !== undefined) {
      const odds = bet.selections.reduce((acc, s) => acc * s.odds, 1);
      if (filter.minOdds !== undefined && odds < filter.minOdds) return false;
      if (filter.maxOdds !== undefined && odds > filter.maxOdds) return false;
    }

    if (search) {
      const haystack = [
        bet.note ?? '',
        bet.bookmaker,
        bet.tipster ?? '',
        ...bet.tags,
        ...bet.selections.flatMap((s) => [
          s.event,
          s.competition,
          s.homeTeam ?? '',
          s.awayTeam ?? '',
          ...s.picks.flatMap((p) => [p.market, p.pick]),
        ]),
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(search)) return false;
    }

    return true;
  });
}

export const store: DataStore = new AsyncStorageStore();
