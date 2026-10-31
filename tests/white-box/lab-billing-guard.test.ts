/**
 * WHITE-BOX TEST SUITE — WB-LAB (the billing switch-off)
 * The function in lab/billing-guard that turns billing off for the Lab's project
 * when a budget notification reports the budget has been reached.
 *
 * Test focus:
 *  - Spend at 0.99 of the budget leaves billing on, and 1.00 turns it off
 *  - The request goes to the project's billingInfo with an empty account name
 *  - It is sent once, even when the message is delivered again
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { onBudget, resetGuard, shouldDisable } from '../../lab/billing-guard/index.ts';

const b64 = (o: unknown) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64');
const cloudEvent = (m: unknown) => ({ data: { message: { data: b64(m) } } });
const legacyEvent = (m: unknown) => ({ data: b64(m) });
const OVER = { costAmount: 100, budgetAmount: 100 };

type Call = { url: string; method: string; body?: string; headers: Record<string, string> };

/** A fake fetch that answers the metadata server and the Billing API. */
function fakeGoogle(billingEnabled = true) {
  const calls: Call[] = [];
  const fetch = vi.fn(async (url: string | URL, init?: RequestInit) => {
    const u = String(url);
    const call: Call = {
      url: u,
      method: init?.method ?? 'GET',
      body: init?.body as string | undefined,
      headers: (init?.headers ?? {}) as Record<string, string>,
    };
    calls.push(call);
    if (u.includes('/service-accounts/default/token')) return Response.json({ access_token: 'tok' });
    if (u.endsWith('/project/project-id')) return new Response('vams-lab-test');
    if (call.method === 'PUT') return Response.json({ billingEnabled: false });
    return Response.json({ billingEnabled });
  });
  return { fetch: fetch as unknown as typeof globalThis.fetch, calls };
}
const puts = (calls: Call[]) => calls.filter((c) => c.method === 'PUT');
const env = { GOOGLE_CLOUD_PROJECT: 'vams-lab-test' };

beforeEach(() => resetGuard());

describe('WB-LAB-10: A budget at 0.99 of its limit leaves billing on, and 1.00 turns it off', () => {
  it('decides on cost against budget', () => {
    expect(shouldDisable({ costAmount: 99, budgetAmount: 100 })).toBe(false);
    expect(shouldDisable({ costAmount: 100, budgetAmount: 100 })).toBe(true);
    expect(shouldDisable({ costAmount: 130, budgetAmount: 100 })).toBe(true);
  });

  it('sends nothing at 0.99', async () => {
    const g = fakeGoogle();
    await onBudget(cloudEvent({ costAmount: 99, budgetAmount: 100 }), { fetch: g.fetch, env });
    expect(puts(g.calls)).toHaveLength(0);
  });

  it('sends the request at 1.00', async () => {
    const g = fakeGoogle();
    await onBudget(cloudEvent(OVER), { fetch: g.fetch, env });
    expect(puts(g.calls)).toHaveLength(1);
  });

  it('logs a malformed message and returns without turning billing off', async () => {
    const warn = vi.spyOn(console, 'error').mockImplementation(() => {});
    const g = fakeGoogle();
    for (const e of [cloudEvent('not json'), cloudEvent({ costAmount: 'x' }), { data: {} }, {}, legacyEvent('{')]) {
      await expect(onBudget(e, { fetch: g.fetch, env })).resolves.toBeUndefined();
    }
    expect(g.calls).toHaveLength(0);
    warn.mockRestore();
  });
});

describe('WB-LAB-11: The request names the project, empties the account, and is sent once', () => {
  it('PUTs an empty billingAccountName to the project billingInfo with the metadata token', async () => {
    const g = fakeGoogle();
    await onBudget(cloudEvent(OVER), { fetch: g.fetch, env });
    const put = puts(g.calls)[0];
    expect(put.url).toBe('https://cloudbilling.googleapis.com/v1/projects/vams-lab-test/billingInfo');
    expect(JSON.parse(put.body!)).toEqual({ billingAccountName: '' });
    expect(put.headers.Authorization).toBe('Bearer tok');
    const token = g.calls.find((c) => c.url.includes('/service-accounts/default/token'))!;
    expect(token.headers['Metadata-Flavor']).toBe('Google');
  });

  it('reads the older background-function shape', async () => {
    const g = fakeGoogle();
    await onBudget(legacyEvent(OVER), { fetch: g.fetch, env });
    expect(puts(g.calls)).toHaveLength(1);
  });

  it('takes the project from the metadata server when the environment lacks it', async () => {
    const g = fakeGoogle();
    await onBudget(cloudEvent(OVER), { fetch: g.fetch, env: {} });
    expect(puts(g.calls)[0].url).toContain('/projects/vams-lab-test/billingInfo');
  });

  it('sends nothing when billing is already off', async () => {
    const g = fakeGoogle(false);
    await onBudget(cloudEvent(OVER), { fetch: g.fetch, env });
    expect(puts(g.calls)).toHaveLength(0);
  });

  it('sends once when the message is delivered again to a warm instance', async () => {
    const g = fakeGoogle();
    await onBudget(cloudEvent(OVER), { fetch: g.fetch, env });
    const before = g.calls.length;
    await onBudget(cloudEvent(OVER), { fetch: g.fetch, env });
    expect(g.calls.length).toBe(before);
    expect(puts(g.calls)).toHaveLength(1);
  });

  it('throws when the PUT fails, so the message is delivered again, and then retries', async () => {
    let fail = true;
    const base = fakeGoogle();
    const fetch = (async (url: string | URL, init?: RequestInit) =>
      init?.method === 'PUT' && fail ? new Response('no', { status: 500 }) : base.fetch(url, init)) as typeof globalThis.fetch;
    await expect(onBudget(cloudEvent(OVER), { fetch, env })).rejects.toThrow();
    fail = false;
    await onBudget(cloudEvent(OVER), { fetch, env });
    expect(puts(base.calls)).toHaveLength(1);
  });
});
