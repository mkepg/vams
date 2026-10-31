/**
 * Turns billing off for the Lab's project when a budget notification reports
 * that the budget has been reached. It is the last safety net behind the
 * compile service's monthly counter. Deployed as a Pub/Sub-triggered function
 * with the entry point onBudget.
 */

const METADATA = 'http://metadata.google.internal/computeMetadata/v1';
const BILLING = 'https://cloudbilling.googleapis.com/v1';
/** A call that takes longer than this fails. */
const CALL_TIMEOUT_MS = 10_000;

export interface BudgetMessage {
  costAmount: number;
  budgetAmount: number;
}

export interface Deps {
  fetch?: typeof fetch;
  env?: Record<string, string | undefined>;
}

/** True once the budget has been reached. */
export const shouldDisable = (m: BudgetMessage): boolean => m.costAmount >= m.budgetAmount;

/**
 * Reads the budget message from a CloudEvent, or from the older background-function
 * shape, and says whether the budget has been reached. A message with no budget
 * amount counts as reached when its alert threshold is 1 or more. Null means the
 * message could not be read.
 */
function reached(event: unknown): boolean | null {
  const data = (event as { data?: unknown } | null)?.data;
  const encoded = typeof data === 'string' ? data : (data as { message?: { data?: unknown } } | undefined)?.message?.data;
  if (typeof encoded !== 'string') return null;
  try {
    const m = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
    if (typeof m?.costAmount === 'number' && typeof m?.budgetAmount === 'number') return shouldDisable(m);
    if (typeof m?.alertThresholdExceeded === 'number') return m.alertThresholdExceeded >= 1;
    return null;
  } catch {
    return null;
  }
}

export async function onBudget(event: unknown, deps: Deps = {}): Promise<void> {
  const doFetch = deps.fetch ?? fetch;
  const env = deps.env ?? process.env;
  const over = reached(event);
  if (over === null) {
    console.error('Budget notification ignored: the message could not be read.');
    return;
  }
  if (!over) return;

  const call = (url: string, init: RequestInit = {}) =>
    doFetch(url, { ...init, signal: AbortSignal.timeout(CALL_TIMEOUT_MS) });
  const meta = { 'Metadata-Flavor': 'Google' };

  let project = env.GOOGLE_CLOUD_PROJECT;
  if (!project) {
    const res = await call(`${METADATA}/project/project-id`, { headers: meta });
    if (!res.ok) throw new Error(`Project id lookup failed: ${res.status}`);
    project = (await res.text()).trim();
  }

  const tokenRes = await call(`${METADATA}/instance/service-accounts/default/token`, { headers: meta });
  if (!tokenRes.ok) throw new Error(`Token request failed: ${tokenRes.status}`);
  const { access_token: token } = (await tokenRes.json()) as { access_token: string };

  const url = `${BILLING}/projects/${project}/billingInfo`;
  const auth = { Authorization: `Bearer ${token}` };

  const info = await call(url, { headers: auth });
  if (!info.ok) throw new Error(`Billing lookup failed: ${info.status}`);
  // Billing already off: a message delivered again sends nothing.
  if (((await info.json()) as { billingEnabled?: boolean }).billingEnabled === false) return;

  const put = await call(url, {
    method: 'PUT',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ billingAccountName: '' }),
  });
  if (!put.ok) throw new Error(`Turning billing off failed: ${put.status}`);
  console.log(`Billing turned off for ${project}.`);
}
