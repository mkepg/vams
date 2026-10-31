/**
 * WHITE-BOX TEST SUITE — WB-LAB (the compile service's limits)
 * The usage stores in lab/service/src/usage.ts: the rate limits per browser and
 * per network, the daily ceiling and the monthly counter. Every limit runs
 * against the memory store and the Firestore store, whose Firestore is a fake fetch.
 *
 * Test focus:
 *  - 30 compiles a minute per visitor, 600 an hour per IP, and a class on one IP
 *  - Run rests at 80% of the month's allowance until the 1st (UTC), and after 4,000 compiles a day
 *  - At most 3 Firestore writes a compile, none for a refusal, and IPs stored as hashes
 */
import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { firestoreStore, memoryStore, type UsageStore } from '../../lab/service/src/usage.ts';
import { ALLOWANCE, DAY_CAP, IP_PER_HOUR, STOP_AT, VISITOR_PER_MIN } from '../../lab/service/src/limits.ts';
import { fakeFirestore } from '../helpers/fake-firestore';

const stores: [string, () => UsageStore][] = [
  ['memoryStore', () => memoryStore()],
  ['firestoreStore', () => firestoreStore('vams-test', { fetch: fakeFirestore().fetch })],
];
const T0 = '2026-10-14T09:00:00Z';
const at = (iso: string, plusMs = 0) => new Date(Date.parse(iso) + plusMs);
const IP = '203.0.113.7';
const OK = { ok: true };

describe("WB-LAB-03: A visitor's 31st compile within one minute is refused", () => {
  it('allows 30 compiles a minute', () => expect(VISITOR_PER_MIN).toBe(30));

  it.each(stores)('%s refuses the 31st with visitor, and only for that visitor', async (_, make) => {
    const store = make();
    for (let i = 0; i < 30; i++) {
      expect(await store.reserve({ visitor: 'v-1', ip: IP, now: at(T0, i * 1000) })).toEqual(OK);
    }
    expect(await store.reserve({ visitor: 'v-1', ip: IP, now: at(T0, 59_999) })).toEqual({ ok: false, reason: 'visitor' });
    expect(await store.reserve({ visitor: 'v-2', ip: IP, now: at(T0, 59_999) })).toEqual(OK);
    // The window opened at the first compile, so a minute later it opens again.
    expect(await store.reserve({ visitor: 'v-1', ip: IP, now: at(T0, 60_000) })).toEqual(OK);
  });
});

describe('WB-LAB-04: 600 compiles an hour from one IP succeed and the 601st is refused', () => {
  it('allows 600 compiles an hour', () => expect(IP_PER_HOUR).toBe(600));

  it.each(stores)('%s refuses the 601st with ip', async (_, make) => {
    const store = make();
    for (let i = 0; i < 600; i++) {
      expect(await store.reserve({ visitor: `v-${i % 20}`, ip: IP, now: at(T0, i * 5000) })).toEqual(OK);
    }
    expect(await store.reserve({ visitor: 'v-new', ip: IP, now: at(T0, 3_000_000) })).toEqual({ ok: false, reason: 'ip' });
    expect(await store.reserve({ visitor: 'v-new', ip: '198.51.100.2', now: at(T0, 3_000_000) })).toEqual(OK);
    expect(await store.reserve({ visitor: 'v-new', ip: IP, now: at(T0, 3_600_000) })).toEqual(OK);
  });
});

describe('WB-LAB-05: 40 visitors on one IP, each compiling once, all succeed', () => {
  it.each(stores)('%s lets a whole lab room compile in the same second', async (_, make) => {
    const store = make();
    for (let i = 0; i < 40; i++) {
      expect(await store.reserve({ visitor: `pc-${i}`, ip: IP, now: at(T0, i * 25) })).toEqual(OK);
    }
  });
});

describe("WB-LAB-06: Run rests once the month reaches 80% of an allowance, until the 1st (UTC)", () => {
  it('measures against the free allowance and stops at 80%', () => {
    expect(ALLOWANCE).toEqual({ requests: 2_000_000, vcpuSeconds: 180_000, gibSeconds: 360_000, egressBytes: 1_073_741_824 });
    expect(STOP_AT).toBe(0.8);
  });

  it.each(stores)('%s rests once settled egress reaches 80%% of 1 GiB', async (_, make) => {
    const store = make();
    const stop = Math.ceil(STOP_AT * ALLOWANCE.egressBytes);
    await store.settle({ bytes: stop - 1, ms: 0, now: at(T0) });
    expect(await store.reserve({ visitor: 'v-1', ip: IP, now: at(T0, 1) })).toEqual(OK);
    await store.settle({ bytes: 1, ms: 0, now: at(T0, 2) });
    expect(await store.reserve({ visitor: 'v-1', ip: IP, now: at(T0, 3) })).toEqual({ ok: false, reason: 'month' });
    // 08:00 on the 1st in Manila is still the 31st in UTC.
    expect(await store.reserve({ visitor: 'v-1', ip: IP, now: new Date('2026-11-01T07:59:00+08:00') })).toEqual({ ok: false, reason: 'month' });
    expect(await store.reserve({ visitor: 'v-1', ip: IP, now: new Date('2026-11-01T00:00:00Z') })).toEqual(OK);
  });

  it.each(stores)('%s rests once vCPU-seconds reach 144,000, counting ms / 1000 × 2', async (_, make) => {
    const store = make();
    await store.settle({ bytes: 0, ms: 71_999_000, now: at(T0) });
    expect(await store.reserve({ visitor: 'v-1', ip: IP, now: at(T0, 1) })).toEqual(OK);
    await store.settle({ bytes: 0, ms: 1000, now: at(T0, 2) });
    expect(await store.reserve({ visitor: 'v-1', ip: IP, now: at(T0, 3) })).toEqual({ ok: false, reason: 'month' });
  });
});

describe('WB-LAB-07: The 4,001st compile of a day returns day', () => {
  it('allows 4,000 compiles a day', () => expect(DAY_CAP).toBe(4000));

  it.each(stores)('%s refuses the 4,001st until the next day (UTC)', async (_, make) => {
    const store = make();
    for (let i = 0; i < DAY_CAP; i++) {
      const now = at('2026-10-14T00:00:00Z', i * 20_000);
      const r = await store.reserve({ visitor: `v-${i}`, ip: `10.0.${i % 40}.1`, now });
      if (!r.ok) throw new Error(`compile ${i + 1} was refused with ${r.reason}`);
      await store.settle({ bytes: 1000, ms: 100, now });
    }
    expect(await store.reserve({ visitor: 'v-late', ip: '10.9.9.9', now: at('2026-10-14T23:59:00Z') })).toEqual({ ok: false, reason: 'day' });
    expect(await store.reserve({ visitor: 'v-late', ip: '10.9.9.9', now: at('2026-10-15T00:00:00Z') })).toEqual(OK);
  }, 30_000);
});

describe('WB-LAB-08: A reserve plus a settle makes at most 3 Firestore writes', () => {
  it('writes the two rate windows in one transaction, then the month in one more write', async () => {
    const fake = fakeFirestore();
    const store = firestoreStore('vams-test', { fetch: fake.fetch });
    expect(await store.reserve({ visitor: 'v-1', ip: IP, now: at(T0) })).toEqual(OK);
    await store.settle({ bytes: 40_000, ms: 1500, now: at(T0, 1500) });
    expect(fake.writes()).toBeLessThanOrEqual(3);

    const urls = fake.calls.map((c) => c.url.split(':').at(-1));
    expect(urls).toContain('beginTransaction');
    const [reserved, settled] = fake.commits().map((c) => c.body as { transaction?: string });
    expect(reserved.transaction).toBe('tx-1');
    expect(settled.transaction).toBeUndefined();

    const month = fake.docs.get(fake.name('usage/2026-10'))!;
    expect(month.requests).toEqual({ integerValue: '1' });
    expect(month.egressBytes).toEqual({ integerValue: '40000' });
    expect(month.vcpuSeconds).toEqual({ doubleValue: 3 });
    expect(month.gibSeconds).toEqual({ doubleValue: 3 });
    expect(month.days.mapValue?.fields?.['14']).toEqual({ integerValue: '1' });

    for (let i = 1; i <= 10; i++) {
      await store.reserve({ visitor: 'v-1', ip: IP, now: at(T0, i * 2000) });
      await store.settle({ bytes: 100, ms: 10, now: at(T0, i * 2000 + 10) });
    }
    expect(fake.writes()).toBeLessThanOrEqual(3 * 11);
    expect(fake.docs.get(fake.name('usage/2026-10'))!.requests).toEqual({ integerValue: '11' });
  });

  it('stores the IP only as its SHA-256 hash, and signs in with the metadata server token', async () => {
    const fake = fakeFirestore();
    const store = firestoreStore('vams-test', { fetch: fake.fetch });
    await store.reserve({ visitor: 'v-1', ip: IP, now: at(T0) });
    await store.settle({ bytes: 10, ms: 10, now: at(T0) });
    await store.reserve({ visitor: 'v-1', ip: IP, now: at(T0, 1000) });

    const hash = createHash('sha256').update(IP).digest('hex');
    expect([...fake.docs.keys()].sort()).toEqual(
      [fake.name('rate/v-1'), fake.name(`rate/ip-${hash}`), fake.name('usage/2026-10')].sort(),
    );
    expect(JSON.stringify(fake.calls)).not.toContain(IP);
    expect(fake.docs.get(fake.name('rate/v-1'))!.count).toEqual({ integerValue: '2' });

    const token = fake.calls.filter((c) => c.url.startsWith('http://metadata.google.internal/'));
    expect(token).toHaveLength(1);
    expect(token[0].headers['metadata-flavor']).toBe('Google');
    const firestoreCalls = fake.calls.filter((c) => c.url.startsWith('https://firestore.googleapis.com/'));
    expect(firestoreCalls.length).toBeGreaterThan(0);
    for (const c of firestoreCalls) expect(c.headers.authorization).toBe('Bearer fake-token');
  });
});

describe('WB-LAB-09: A refusal while resting makes no writes, and the instance keeps the answer for 60 s', () => {
  it('refuses a full month with no writes, then answers without Firestore for 60 s', async () => {
    const fake = fakeFirestore();
    fake.docs.set(fake.name('usage/2026-10'), { egressBytes: { integerValue: String(ALLOWANCE.egressBytes) } });
    const store = firestoreStore('vams-test', { fetch: fake.fetch });
    expect(await store.reserve({ visitor: 'v-1', ip: IP, now: at(T0) })).toEqual({ ok: false, reason: 'month' });
    expect(fake.writes()).toBe(0);

    const asked = fake.calls.length;
    expect(await store.reserve({ visitor: 'v-2', ip: '198.51.100.2', now: at(T0, 59_999) })).toEqual({ ok: false, reason: 'month' });
    expect(fake.calls).toHaveLength(asked);
    expect(await store.reserve({ visitor: 'v-2', ip: '198.51.100.2', now: at(T0, 60_000) })).toEqual({ ok: false, reason: 'month' });
    expect(fake.calls.length).toBeGreaterThan(asked);
    expect(fake.writes()).toBe(0);
  });

  it('keeps a full day for 60 s too, but not past midnight (UTC)', async () => {
    const fake = fakeFirestore();
    fake.docs.set(fake.name('usage/2026-10'), { days: { mapValue: { fields: { '14': { integerValue: String(DAY_CAP) } } } } });
    const store = firestoreStore('vams-test', { fetch: fake.fetch });
    const late = '2026-10-14T23:59:30Z';
    expect(await store.reserve({ visitor: 'v-1', ip: IP, now: at(late) })).toEqual({ ok: false, reason: 'day' });
    const asked = fake.calls.length;
    expect(await store.reserve({ visitor: 'v-1', ip: IP, now: at(late, 29_000) })).toEqual({ ok: false, reason: 'day' });
    expect(fake.calls).toHaveLength(asked);
    expect(await store.reserve({ visitor: 'v-1', ip: IP, now: at(late, 30_000) })).toEqual(OK);
  });

  it('remembers a refused visitor or IP until its window ends, without asking Firestore', async () => {
    const fake = fakeFirestore();
    const store = firestoreStore('vams-test', { fetch: fake.fetch });
    for (let i = 0; i < 30; i++) await store.reserve({ visitor: 'v-1', ip: IP, now: at(T0, i) });
    const writes = fake.writes();
    expect(await store.reserve({ visitor: 'v-1', ip: IP, now: at(T0, 100) })).toEqual({ ok: false, reason: 'visitor' });
    const asked = fake.calls.length;
    expect(await store.reserve({ visitor: 'v-1', ip: IP, now: at(T0, 59_999) })).toEqual({ ok: false, reason: 'visitor' });
    expect(fake.calls).toHaveLength(asked);
    expect(fake.writes()).toBe(writes);
    expect(await store.reserve({ visitor: 'v-1', ip: IP, now: at(T0, 60_000) })).toEqual(OK);
  });
});
