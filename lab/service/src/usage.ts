/**
 * Where the compile service counts compiles. `reserve` runs before a compile and
 * refuses it over a rate limit or while Run is resting; `settle` runs after and
 * adds the compile's cost to the month.
 *
 * firestoreStore keeps three documents a compile touches:
 *   usage/<yyyy-mm>    the month's totals, and each day's compiles in `days`
 *   rate/<visitor>     the visitor's minute window
 *   rate/ip-<sha256>   the IP address's hour window, named by the address's hash
 * A reserve writes the two windows in one transaction and a settle writes the
 * month, so a compile costs 3 writes. A refusal writes nothing.
 */
import { createHash } from 'node:crypto';
import { double, fieldPath, firestore, FirestoreError, int, numberOf, type Fields, type Write } from './firestore.ts';
import {
  cost,
  dayKey,
  dayOfMonth,
  decide,
  emptyMonth,
  HOUR_MS,
  MINUTE_MS,
  monthKey,
  type Month,
  type Reason,
  type Window,
} from './limits.ts';

export type Reservation = { ok: true } | { ok: false; reason: Reason };

export interface UsageStore {
  reserve(input: { visitor: string; ip: string; now: Date }): Promise<Reservation>;
  settle(input: { bytes: number; ms: number; now: Date }): Promise<void>;
}

/** Past this many entries, a map of windows drops the ones that have ended. */
const PRUNE_AT = 10_000;
function prune<T>(map: Map<string, T>, ended: (value: T) => boolean): void {
  if (map.size < PRUNE_AT) return;
  for (const [key, value] of map) if (ended(value)) map.delete(key);
}

/** Counts in this instance's memory: for tests and for runs without a Google Cloud project. */
export function memoryStore(): UsageStore {
  const months = new Map<string, Month>();
  const visitors = new Map<string, Window>();
  const ips = new Map<string, Window>();
  return {
    async reserve({ visitor, ip, now }) {
      const month = months.get(monthKey(now)) ?? emptyMonth();
      const d = decide({ month, visitor: visitors.get(visitor), ip: ips.get(ip) }, now);
      if (!d.ok) return { ok: false, reason: d.reason };
      const t = now.getTime();
      prune(visitors, (w) => t - w.start >= MINUTE_MS);
      prune(ips, (w) => t - w.start >= HOUR_MS);
      visitors.set(visitor, d.visitor);
      ips.set(ip, d.ip);
      return { ok: true };
    },
    async settle({ bytes, ms, now }) {
      const key = monthKey(now);
      const month = months.get(key) ?? emptyMonth();
      const c = cost(bytes, ms);
      month.requests += c.requests;
      month.vcpuSeconds += c.vcpuSeconds;
      month.gibSeconds += c.gibSeconds;
      month.egressBytes += c.egressBytes;
      const day = dayOfMonth(now);
      month.days[day] = (month.days[day] ?? 0) + 1;
      months.set(key, month);
    },
  };
}

/** A reserve tries this many times when another one holds the same documents. */
const ATTEMPTS = 5;
/** Firestore answers 409 ABORTED when a transaction loses to another. */
const CONTENDED = 409;

const readWindow = (fields: Fields | null | undefined): Window | undefined =>
  fields ? { start: numberOf(fields.start), count: numberOf(fields.count) } : undefined;

function readMonth(fields: Fields | null | undefined): Month {
  const month = emptyMonth();
  if (!fields) return month;
  month.requests = numberOf(fields.requests);
  month.vcpuSeconds = numberOf(fields.vcpuSeconds);
  month.gibSeconds = numberOf(fields.gibSeconds);
  month.egressBytes = numberOf(fields.egressBytes);
  for (const [day, n] of Object.entries(fields.days?.mapValue?.fields ?? {})) month.days[day] = numberOf(n);
  return month;
}

/** A refusal this instance keeps without asking Firestore: until a time, within one month or day. */
interface Kept {
  reason: Reason;
  until: number;
  period?: string;
}

export function firestoreStore(project: string, options: { fetch?: typeof fetch } = {}): UsageStore {
  const db = firestore(project, options.fetch);
  let resting: Kept | null = null;
  const refused = new Map<string, Kept>();

  const keptFor = (keys: string[], now: Date): Reservation | null => {
    const t = now.getTime();
    if (resting && t < resting.until && resting.period === (resting.reason === 'month' ? monthKey(now) : dayKey(now))) {
      return { ok: false, reason: resting.reason };
    }
    for (const key of keys) {
      const kept = refused.get(key);
      if (kept && t < kept.until) return { ok: false, reason: kept.reason };
    }
    return null;
  };

  const keep = (reason: Reason, until: number, now: Date, key: string) => {
    if (reason === 'month' || reason === 'day') {
      resting = { reason, until, period: reason === 'month' ? monthKey(now) : dayKey(now) };
    } else {
      prune(refused, (k) => now.getTime() >= k.until);
      refused.set(key, { reason, until });
    }
  };

  const windowWrite = (path: string, w: Window, size: number): Write => ({
    update: {
      name: db.name(path),
      // `expires` is there for a Firestore TTL policy to delete the window once it has ended.
      fields: { start: int(w.start), count: int(w.count), expires: { timestampValue: new Date(w.start + size).toISOString() } },
    },
  });

  return {
    async reserve({ visitor, ip, now }) {
      // Visitor ids are at most 64 characters, so none can name an IP's document.
      const visitorPath = `rate/${visitor}`;
      const ipPath = `rate/ip-${createHash('sha256').update(ip, 'utf8').digest('hex')}`;
      const kept = keptFor([visitorPath, ipPath], now);
      if (kept) return kept;

      const monthPath = `usage/${monthKey(now)}`;
      let lost: string | undefined;
      for (let attempt = 1; ; attempt++) {
        const transaction = await db.begin(lost);
        try {
          const docs = await db.get([monthPath, visitorPath, ipPath], transaction);
          const d = decide({ month: readMonth(docs.get(monthPath)), visitor: readWindow(docs.get(visitorPath)), ip: readWindow(docs.get(ipPath)) }, now);
          if (!d.ok) {
            await db.rollback(transaction).catch(() => {});
            keep(d.reason, d.until, now, d.reason === 'visitor' ? visitorPath : ipPath);
            return { ok: false, reason: d.reason };
          }
          await db.commit([windowWrite(visitorPath, d.visitor, MINUTE_MS), windowWrite(ipPath, d.ip, HOUR_MS)], transaction);
          return { ok: true };
        } catch (e) {
          await db.rollback(transaction).catch(() => {});
          if (!(e instanceof FirestoreError && e.status === CONTENDED) || attempt >= ATTEMPTS) throw e;
          lost = transaction;
          await new Promise((r) => setTimeout(r, 20 * attempt + Math.random() * 30));
        }
      }
    },

    async settle({ bytes, ms, now }) {
      const c = cost(bytes, ms);
      await db.commit([
        {
          update: { name: db.name(`usage/${monthKey(now)}`), fields: {} },
          updateMask: { fieldPaths: [] },
          updateTransforms: [
            { fieldPath: 'requests', increment: int(c.requests) },
            { fieldPath: 'vcpuSeconds', increment: double(c.vcpuSeconds) },
            { fieldPath: 'gibSeconds', increment: double(c.gibSeconds) },
            { fieldPath: 'egressBytes', increment: int(c.egressBytes) },
            { fieldPath: fieldPath('days', dayOfMonth(now)), increment: int(1) },
          ],
        },
      ]);
    },
  };
}
