/**
 * The compile service's limits: the free allowance the monthly counter measures
 * against, the daily ceiling and the rate limits, and the rules that apply them.
 * Both usage stores decide with `decide`, so they refuse alike.
 */

/** Cloud Run's always-free allowance a month, checked 2026-10-28. */
export const ALLOWANCE = { requests: 2_000_000, vcpuSeconds: 180_000, gibSeconds: 360_000, egressBytes: 1_073_741_824 };
/** Run rests once any part of the month's allowance reaches this share. */
export const STOP_AT = 0.8;
/** Compiles a day, so Firestore's writes stay inside its free 20,000 a day. */
export const DAY_CAP = 4000;
export const VISITOR_PER_MIN = 30;
export const IP_PER_HOUR = 600;
export const MINUTE_MS = 60_000;
export const HOUR_MS = 3_600_000;
/** How long an instance keeps a resting answer before it asks the store again. */
export const RESTING_CACHE_MS = 60_000;
/** Each instance has 2 vCPUs and 2 GiB. A compile is counted as using all of both. */
export const VCPUS = 2;
export const GIB = 2;

export type Usage = { [K in keyof typeof ALLOWANCE]: number };
/** A month's totals, with each day's compiles by day of the month ('01' to '31'). */
export interface Month extends Usage {
  days: Record<string, number>;
}
/** A fixed window: it opens at its first compile and counts until `size` ms later. */
export interface Window {
  start: number;
  count: number;
}
export type Reason = 'visitor' | 'ip' | 'day' | 'month';

export const monthKey = (now: Date) => now.toISOString().slice(0, 7);
export const dayKey = (now: Date) => now.toISOString().slice(0, 10);
export const dayOfMonth = (now: Date) => now.toISOString().slice(8, 10);

export const emptyMonth = (): Month => ({ requests: 0, vcpuSeconds: 0, gibSeconds: 0, egressBytes: 0, days: {} });

/** What one compile adds to the month. Overlapping compiles are each counted in full. */
export function cost(bytes: number, ms: number): Usage {
  const seconds = ms / 1000;
  return { requests: 1, vcpuSeconds: seconds * VCPUS, gibSeconds: seconds * GIB, egressBytes: bytes };
}

export function monthFull(month: Usage): boolean {
  return (Object.keys(ALLOWANCE) as (keyof Usage)[]).some((k) => month[k] >= STOP_AT * ALLOWANCE[k]);
}

/** Counts one more compile in a window, or returns null when the window is full. */
export function take(window: Window | undefined, now: number, size: number, limit: number): Window | null {
  const open = window && now - window.start < size ? window : { start: now, count: 0 };
  if (open.count >= limit) return null;
  return { start: open.start, count: open.count + 1 };
}

export type Decision =
  | { ok: true; visitor: Window; ip: Window }
  /** `until` is when asking again could give a different answer. */
  | { ok: false; reason: Reason; until: number };

/** Whether a compile may run, and the rate windows to store if it may. */
export function decide(state: { month: Month; visitor?: Window; ip?: Window }, now: Date): Decision {
  const t = now.getTime();
  if (monthFull(state.month)) return { ok: false, reason: 'month', until: t + RESTING_CACHE_MS };
  if ((state.month.days[dayOfMonth(now)] ?? 0) >= DAY_CAP) return { ok: false, reason: 'day', until: t + RESTING_CACHE_MS };
  const visitor = take(state.visitor, t, MINUTE_MS, VISITOR_PER_MIN);
  if (!visitor) return { ok: false, reason: 'visitor', until: state.visitor!.start + MINUTE_MS };
  const ip = take(state.ip, t, HOUR_MS, IP_PER_HOUR);
  if (!ip) return { ok: false, reason: 'ip', until: state.ip!.start + HOUR_MS };
  return { ok: true, visitor, ip };
}
