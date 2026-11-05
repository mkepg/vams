/**
 * WHITE-BOX TEST SUITE — WB-LAB (the Lab's setup and live-check scripts)
 * scripts/lab: publish-runtime.mjs, load-test.mjs, setup-helpers.mjs and setup-gcp.sh,
 * checked offline. Nothing here reaches Google Cloud or Cloudflare.
 *
 * Test focus:
 *  - The runtime version is the emsdk version and a hash of the files, whatever their order
 *  - The live checks pass against a local service with stand-ins for Firestore, Pub/Sub and
 *    Logging, fail when they should, and put the month's counter back even when a check fails
 *  - Results land in the Live checks table of docs/lab-operations.md
 *  - setup-gcp.sh holds the limits, region and wiring the plan fixes, and the guard's deploy
 *    copy loads as plain JavaScript and switches billing off
 */
import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createService } from '../../lab/service/src/server.ts';
import { firestoreStore, memoryStore, type UsageStore } from '../../lab/service/src/usage.ts';
import { checkIncludes } from '../../lab/service/src/includes.ts';
import type { CompileResult } from '../../lab/service/src/compile.ts';
import { ALLOWANCE, monthKey, STOP_AT } from '../../lab/service/src/limits.ts';
import { outputFiles, plannedKeys, runtimeVersion, versionModule } from '../../scripts/lab/publish-runtime.mjs';
import { CHECKS, context, lowerEgress, recordResults, runChecks, SPIN } from '../../scripts/lab/load-test.mjs';
import { guardPackage, serviceLimits, SERVICE_LIMITS, writeGuard } from '../../scripts/lab/setup-helpers.mjs';
import { onBudget } from '../../lab/billing-guard/index.ts';
import { fakeFirestore } from '../helpers/fake-firestore';

const ROOT = process.cwd();
const temps: string[] = [];
const temp = () => {
  // Inside the checkout, where the test runner can import from; node_modules is never committed.
  mkdirSync(join(ROOT, 'node_modules/.tmp'), { recursive: true });
  const dir = mkdtempSync(join(ROOT, 'node_modules/.tmp/lab-scripts-'));
  temps.push(dir);
  return dir;
};
afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('WB-LAB-15: The runtime version is <EMSDK_VERSION>-<sha8> of the files', () => {
  const a = { name: 'vams_main.mjs', bytes: Buffer.from('export default 1;') };
  const b = { name: 'vams_main.wasm', bytes: Buffer.from([0, 0x61, 0x73, 0x6d, 1, 0, 0, 0]) };

  it('is the same whatever order the files come in, and changes with any byte or name', () => {
    const v = runtimeVersion('4.0.10', [a, b]);
    expect(v).toMatch(/^4\.0\.10-[0-9a-f]{8}$/);
    expect(runtimeVersion('4.0.10', [b, a])).toBe(v);
    expect(runtimeVersion('4.0.10', [a, { ...b, bytes: Buffer.from([0, 0x61, 0x73, 0x6d, 1, 0, 0, 1]) }])).not.toBe(v);
    expect(runtimeVersion('4.0.10', [a, { ...b, name: 'vams_main2.wasm' }])).not.toBe(v);
    expect(runtimeVersion('4.0.11', [a, b]).slice(-8)).toBe(v.slice(-8));
  });

  it('plans one key per file under the version, and writes the version as one exported constant', () => {
    expect(plannedKeys('4.0.10-0123abcd', ['vams_main.wasm', 'vams_main.mjs'])).toEqual([
      '4.0.10-0123abcd/vams_main.mjs',
      '4.0.10-0123abcd/vams_main.wasm',
    ]);
    const source = versionModule('4.0.10-0123abcd');
    expect(source.match(/^export /gm)).toHaveLength(1);
    expect(source).toContain("export const runtimeVersion = '4.0.10-0123abcd';");
  });

  it('uploads the files the build left, and not the folders beside them', () => {
    const dir = temp();
    writeFileSync(join(dir, 'vams_main.wasm'), 'w');
    writeFileSync(join(dir, 'vams_main.mjs'), 'm');
    mkdirSync(join(dir, 'check'));
    writeFileSync(join(dir, 'check', 'hello.wasm'), 'h');
    expect(outputFiles(dir).map((f: { name: string }) => f.name)).toEqual(['vams_main.mjs', 'vams_main.wasm']);
  });
});

describe('WB-LAB-16: The live checks pass against a local service, fail when they should, and restore the counter', () => {
  const SECRET = 'scripts-test-secret';
  const PROJECT = 'vams-test';
  let server: Server | null = null;

  afterEach(async () => {
    await new Promise<void>((done) => (server ? server.close(() => done()) : done()));
    server = null;
  });

  /** A compile that refuses what checkIncludes refuses and times out the spin, without clang. */
  const fakeCompile = async (source: string): Promise<CompileResult> => {
    const r = checkIncludes(source);
    if (!r.ok) return { ok: false, diagnostics: [{ file: 'main.cpp', line: r.line, col: r.col, severity: 'error', message: r.message }], ms: 1 };
    if (source === SPIN) {
      await new Promise((go) => setTimeout(go, 60));
      return {
        ok: false,
        diagnostics: [{ file: 'main.cpp', line: 1, col: 1, severity: 'error', message: 'The compile took longer than 10 seconds, so it was stopped.' }],
        ms: 60,
      };
    }
    return { ok: true, module: new Uint8Array([0, 0x61, 0x73, 0x6d, 1, 0, 0, 0]), diagnostics: [], ms: 2 };
  };

  async function start(usage: UsageStore, secret = SECRET): Promise<string> {
    server = createService({ secret, usage, compile: fakeCompile, concurrency: 2 });
    await new Promise<void>((done) => server!.listen(0, '127.0.0.1', () => done()));
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }
  const quiet = () => {};
  const monthDoc = (fake: ReturnType<typeof fakeFirestore>) => fake.name(`usage/${monthKey(new Date())}`);

  /**
   * Firestore, plus Pub/Sub and Logging as the deployed guard sees them: a message published to
   * the budget topic runs the guard's source, and what it logs is what entries:list returns.
   * `skewMs` stamps each line that much before the publish, as Google's clock would against a
   * local one running ahead, and `payload` says whether a line is text or structured JSON.
   */
  function fakeGoogle(guard: 'deployed' | 'silent' = 'deployed', { skewMs = 0, payload = 'text' } = {}) {
    const fake = fakeFirestore(PROJECT);
    const published: { budgetDisplayName: string; costAmount: number; budgetAmount: number }[] = [];
    const logs: { line: string; timestamp: string }[] = [];
    const filters: string[] = [];
    const answer = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
    const fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url === `https://pubsub.googleapis.com/v1/projects/${PROJECT}/topics/budget:publish`) {
        const { messages } = JSON.parse(String(init!.body));
        published.push(JSON.parse(Buffer.from(messages[0].data, 'base64').toString('utf8')));
        if (guard === 'deployed') {
          const log = console.log;
          const timestamp = new Date(Date.now() - skewMs).toISOString();
          console.log = (...a: unknown[]) => void logs.push({ line: `${a.join(' ')}\n`, timestamp });
          try {
            await onBudget({ data: { message: { data: messages[0].data } } }, {
              fetch: (async () => {
                throw new Error('the guard asked Google something');
              }) as typeof globalThis.fetch,
              env: { GOOGLE_CLOUD_PROJECT: PROJECT },
            });
          } finally {
            console.log = log;
          }
        }
        return answer({ messageIds: ['1'] });
      }
      if (url === 'https://logging.googleapis.com/v2/entries:list') {
        const { filter } = JSON.parse(String(init!.body));
        filters.push(filter);
        // The filter's bare string, and the time it starts from.
        const name = / AND "([^"]+)"$/.exec(filter)![1];
        const since = Date.parse(/timestamp>="([^"]+)"/.exec(filter)![1]);
        const entries = logs
          .filter((l) => l.line.includes(name) && Date.parse(l.timestamp) >= since)
          .map((l) => (payload === 'text' ? { textPayload: l.line } : { jsonPayload: { message: l.line.trim() } }));
        return answer({ entries });
      }
      return fake.fetch(input, init);
    }) as typeof globalThis.fetch;
    return { fake, fetch, published, logs, filters };
  }

  it('passes every check, and leaves the month below 80%', async () => {
    const { fake, fetch, published } = fakeGoogle();
    fake.docs.set(monthDoc(fake), { egressBytes: { integerValue: '12345' } });
    const url = await start(firestoreStore(PROJECT, { fetch: fake.fetch }));
    const lines: string[] = [];
    const ctx = context({
      url,
      secret: SECRET,
      project: PROJECT,
      fetch,
      token: () => 'fake-token',
      logPollMs: 10,
      timeLimitMs: 50,
      slackMs: 2_000,
      log: (line: string) => lines.push(line),
    });
    const results = await runChecks(ctx);
    expect(results.map((r: { id: string }) => r.id)).toEqual([
      'SEC-LAB-04', 'SEC-LAB-05', 'SEC-LAB-06', 'SEC-LAB-08', 'SEC-LAB-09', 'SEC-LAB-07', 'SEC-LAB-10',
    ]);
    for (const r of results) expect(r, r.detail).toMatchObject({ pass: true });
    expect(lines).toHaveLength(CHECKS.length);
    expect(lines.every((l) => l.startsWith('PASS SEC-LAB-'))).toBe(true);
    // SEC-LAB-08 and SEC-LAB-09 add what they sent; SEC-LAB-07 takes back only what it added.
    const egress = Number(fake.docs.get(monthDoc(fake))!.egressBytes!.integerValue);
    expect(egress).toBeGreaterThan(12345);
    expect(egress).toBeLessThan(12345 + 100_000);
    // SEC-LAB-10 sent one message, below the budget, in Cloud Billing's shape.
    expect(published).toHaveLength(1);
    expect(published[0]).toMatchObject({ costAmount: 0.5, budgetAmount: 1, alertThresholdExceeded: 0.5, currencyCode: 'USD' });
  }, 30_000);

  it('raises the counter to 80% of the egress allowance for SEC-LAB-07', async () => {
    const fake = fakeFirestore(PROJECT);
    let seen = 0;
    const fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const res = await fake.fetch(input, init);
      if (String(input).endsWith(':batchGet') && fake.docs.get(monthDoc(fake))) {
        seen = Math.max(seen, Number(fake.docs.get(monthDoc(fake))!.egressBytes?.integerValue ?? 0));
      }
      return res;
    }) as typeof globalThis.fetch;
    const url = await start(firestoreStore(PROJECT, { fetch }));
    const ctx = context({ url, secret: SECRET, project: PROJECT, fetch, token: () => 'fake-token', log: quiet });
    const [r] = await runChecks(ctx, ['SEC-LAB-07']);
    expect(r.pass).toBe(true);
    expect(seen).toBe(Math.ceil(STOP_AT * ALLOWANCE.egressBytes));
    expect(fake.docs.get(monthDoc(fake))!.egressBytes).toEqual({ integerValue: '0' });
  });

  it('puts the counter back even when the compile fails', async () => {
    const fake = fakeFirestore(PROJECT);
    fake.docs.set(monthDoc(fake), { egressBytes: { integerValue: '777' } });
    // Nothing listens here, so the compile throws.
    const ctx = context({ url: 'http://127.0.0.1:9', secret: SECRET, project: PROJECT, fetch: fake.fetch, token: () => 'fake-token', log: quiet });
    const [r] = await runChecks(ctx, ['SEC-LAB-07']);
    expect(r.pass).toBe(false);
    expect(r.detail).toMatch(/^threw: /);
    expect(fake.docs.get(monthDoc(fake))!.egressBytes).toEqual({ integerValue: '777' });
  });

  it('names a failed restore, how high the counter was left and the command that lowers it', async () => {
    const fake = fakeFirestore(PROJECT);
    let commits = 0;
    const fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      if (String(input).endsWith(':commit') && ++commits === 2) return new Response('unavailable', { status: 503 });
      return fake.fetch(input, init);
    }) as typeof globalThis.fetch;
    const url = await start(firestoreStore(PROJECT, { fetch: fake.fetch }));
    const ctx = context({ url, secret: SECRET, project: PROJECT, fetch, token: () => 'fake-token', log: quiet });
    const [r] = await runChecks(ctx, ['SEC-LAB-07']);
    const delta = Math.ceil(STOP_AT * ALLOWANCE.egressBytes);
    expect(r.pass).toBe(false);
    expect(r.detail).toMatch(/^RESTORE FAILED \(firestore\.googleapis\.com answered 503: unavailable\)/);
    expect(r.detail).toContain(`egressBytes is still ${delta} bytes high, so the Lab rests until it is lowered.`);
    expect(r.detail).toContain(`load-test.mjs --project ${PROJECT} --lower-egress ${delta}`);

    // The command it names puts the counter back.
    await lowerEgress(context({ project: PROJECT, fetch: fake.fetch, token: () => 'fake-token' }), delta);
    expect(fake.docs.get(monthDoc(fake))!.egressBytes).toEqual({ integerValue: '0' });
  });

  it('lowers nothing when the raise itself failed', async () => {
    const fake = fakeFirestore(PROJECT);
    fake.docs.set(monthDoc(fake), { egressBytes: { integerValue: '777' } });
    const commits: unknown[] = [];
    const fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      if (String(input).endsWith(':commit')) {
        commits.push(JSON.parse(String(init!.body)));
        return new Response('denied', { status: 403 });
      }
      return fake.fetch(input, init);
    }) as typeof globalThis.fetch;
    const ctx = context({ url: 'http://127.0.0.1:9', secret: SECRET, project: PROJECT, fetch, token: () => 'fake-token', log: quiet });
    const [r] = await runChecks(ctx, ['SEC-LAB-07']);
    expect(r.pass).toBe(false);
    expect(r.detail).toMatch(/^threw: firestore\.googleapis\.com answered 403/);
    expect(commits).toHaveLength(1);
    expect(fake.docs.get(monthDoc(fake))!.egressBytes).toEqual({ integerValue: '777' });
  });

  it("finds the guard's line stamped up to a minute before the publish, by its name in any field", async () => {
    const { fetch, filters } = fakeGoogle('deployed', { skewMs: 59_000 });
    const ctx = context({ project: PROJECT, fetch, token: () => 'fake-token', log: quiet, logWaitMs: 50, logPollMs: 10 });
    const [r] = await runChecks(ctx, ['SEC-LAB-10']);
    expect(r, r.detail).toMatchObject({ pass: true });
    expect(filters[0]).toMatch(/ AND "vams-lab live check [0-9a-f]+"$/);
    expect(filters[0]).not.toContain('textPayload');

    // A line older than the minute is out of the window.
    const late = fakeGoogle('deployed', { skewMs: 65_000 });
    const [missed] = await runChecks({ ...ctx, fetch: late.fetch }, ['SEC-LAB-10']);
    expect(missed.pass).toBe(false);
  });

  it("reads a line the guard logged as structured JSON, from jsonPayload.message", async () => {
    const { fetch } = fakeGoogle('deployed', { payload: 'json' });
    const ctx = context({ project: PROJECT, fetch, token: () => 'fake-token', log: quiet, logWaitMs: 50, logPollMs: 10 });
    const [r] = await runChecks(ctx, ['SEC-LAB-10']);
    expect(r, r.detail).toMatchObject({ pass: true });
  });

  it('fails SEC-LAB-10 when the deployed guard logs nothing for the message in time', async () => {
    const { fetch, published } = fakeGoogle('silent');
    const ctx = context({ project: PROJECT, fetch, token: () => 'fake-token', log: quiet, logWaitMs: 50, logPollMs: 10 });
    const [r] = await runChecks(ctx, ['SEC-LAB-10']);
    expect(published).toHaveLength(1);
    expect(r.pass).toBe(false);
    expect(r.detail).toMatch(/^pre-check passed; published to budget, but the guard logged no "Budget vams-lab live check [0-9a-f]+ not reached \(0\.5 of 1\): billing stays on\." within 0\.05 s$/);
  });

  it('fails the checks a wrongly set up service fails, and skips what it has no settings for', async () => {
    // A service holding another secret refuses everything: SEC-LAB-04 still passes, the compiles fail.
    const url = await start(memoryStore(), 'another-secret');
    const lines: string[] = [];
    const ctx = context({ url, secret: SECRET, log: (l: string) => lines.push(l), classSize: 3 });
    const results = await runChecks(ctx, ['SEC-LAB-04', 'SEC-LAB-05', 'SEC-LAB-09', 'SEC-LAB-07', 'SEC-LAB-10']);
    expect(results.map((r: { pass: boolean }) => r.pass)).toEqual([true, false, false, false, false]);
    expect(lines[1]).toMatch(/^FAIL SEC-LAB-05 .*probe 1: 401/);
    expect(lines[3]).toBe('FAIL SEC-LAB-07 At 80% of the month the next compile is 503 resting: skipped: needs project');
    expect(lines[4]).toBe('FAIL SEC-LAB-10 The deployed guard reads a budget message from the budget topic: skipped: needs project');
  });
});

describe('WB-LAB-17: Results are added to the Live checks table in docs/lab-operations.md', () => {
  const doc = readFileSync(join(ROOT, 'docs/lab-operations.md'), 'utf8');
  const results = [
    { id: 'SEC-LAB-04', pass: true, detail: 'no secret: 401, wrong secret: 401' },
    { id: 'SEC-LAB-07', pass: false, detail: 'got 200 | not 503' },
  ];

  it('adds a row per check at the end of the table, after the rows already there', () => {
    const once = recordResults(doc, results.slice(0, 1), '2026-11-03');
    const twice = recordResults(once, results.slice(1), '2026-11-04');
    const table = twice.split(/\r?\n/).filter((l) => l.startsWith('| SEC-LAB-'));
    expect(table).toEqual([
      '| SEC-LAB-04 | pass | no secret: 401, wrong secret: 401 | 2026-11-03 |',
      '| SEC-LAB-07 | fail | got 200 \\| not 503 | 2026-11-04 |',
    ]);
    const lines = twice.split(/\r?\n/);
    const header = lines.indexOf('| Check | Result | Detail | Run |');
    expect(lines[header + 2]).toBe(table[0]);
  });

  it("keeps the doc's line endings and every other line", () => {
    const crlf = doc.replace(/\r?\n/g, '\r\n');
    const out = recordResults(crlf, results, '2026-11-03');
    expect(out.split('\r\n').length).toBe(crlf.split('\r\n').length + 2);
    expect(out.replace(/\| SEC-LAB-0[47] \|[^\r]*\r\n/g, '')).toBe(crlf);
  });

  it('refuses a doc without the section', () => {
    expect(() => recordResults('# Elsewhere\n', results, '2026-11-03')).toThrow(/Live checks/);
  });
});

describe('WB-LAB-18: setup-gcp.sh sets the planned limits and wiring, and the guard deploys as JavaScript', () => {
  const script = readFileSync(join(ROOT, 'scripts/lab/setup-gcp.sh'), 'utf8');
  const joined = script.replace(/\\\n\s*/g, '');

  it('is a strict bash script with LF line endings', () => {
    expect(script).not.toContain('\r');
    expect(script.startsWith('#!/usr/bin/env bash\n')).toBe(true);
    expect(script).toMatch(/^set -euo pipefail$/m);
  });

  it('deploys lab-compile with the limits verbatim, its project and its secret', () => {
    const deploy = joined.split('\n').find((l) => l.includes('run deploy "$SERVICE"'))!;
    expect(deploy).toContain('--max-instances 3 --min-instances 0 --concurrency 2 --cpu 2 --memory 2Gi --timeout 30 --allow-unauthenticated');
    expect(deploy).toContain('--set-env-vars="GOOGLE_CLOUD_PROJECT=$PROJECT"');
    expect(deploy).toContain('--set-secrets="LAB_SECRET=$SECRET:latest"');
    expect(deploy).toContain('--service-account="$RUN_SA"');
    expect(script).toMatch(/^SERVICE=lab-compile$/m);
    expect(script).toMatch(/^SECRET=lab-secret$/m);
  });

  it('works in us-central1 only', () => {
    expect(script).toMatch(/^REGION=us-central1$/m);
    expect(script.match(/\b(?:us|europe|asia|australia|northamerica|southamerica|me|africa)-[a-z]+\d\b/g)).toEqual(['us-central1']);
  });

  it('wires the budget, the topic and the guard as the plan says', () => {
    expect(joined).toContain('--threshold-rule=percent=0.5 --threshold-rule=percent=0.9 --threshold-rule=percent=1.0');
    expect(joined).toContain('--notifications-rule-pubsub-topic="projects/$PROJECT/topics/$TOPIC"');
    const guard = joined.split('\n').find((l) => l.includes('functions deploy "$GUARD"'))!;
    for (const flag of ['--gen2', '--runtime=nodejs22', '--entry-point=onBudget', '--trigger-topic="$TOPIC"', '--retry', '--set-env-vars="GOOGLE_CLOUD_PROJECT=$PROJECT"']) {
      expect(guard).toContain(flag);
    }
    expect(joined).toContain('--role=roles/billing.projectManager');
    expect(joined).toContain('--role=roles/datastore.user');
    expect(joined).toContain('--role=roles/secretmanager.secretAccessor');
    expect(joined).toContain('npx wrangler pages secret put LAB_COMPILE_SECRET --project-name vams');
  });

  it("writes a guard that Node loads as JavaScript and the Functions Framework calls with the event alone", async () => {
    const dir = temp();
    writeGuard(dir);
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    expect(pkg).toMatchObject({ type: 'module', main: 'index.js' });
    expect(pkg.engines).toBeUndefined();
    expect(guardPackage().main).toBe('index.js');
    const source = readFileSync(join(dir, 'index.js'), 'utf8');
    expect(source).not.toMatch(/\binterface\b|: Promise<void>/);
    const guard = await import(pathToFileURL(join(dir, 'index.js')).href);
    // More than one parameter would make the framework pass a callback as the second.
    expect(guard.onBudget.length).toBe(1);

    const sent: { url: string; method: string }[] = [];
    const fetch = async (url: string | URL, init: RequestInit = {}) => {
      sent.push({ url: String(url), method: init.method ?? 'GET' });
      if (String(url).endsWith('/token')) return Response.json({ access_token: 't' });
      return Response.json({ billingEnabled: init.method !== 'PUT' });
    };
    const data = Buffer.from(JSON.stringify({ costAmount: 1, budgetAmount: 1 })).toString('base64');
    const log = console.log;
    console.log = () => {};
    try {
      await guard.onBudget({ data: { message: { data } } }, { fetch, env: { GOOGLE_CLOUD_PROJECT: 'p' } });
    } finally {
      console.log = log;
    }
    expect(sent.filter((c) => c.method === 'PUT').map((c) => c.url)).toEqual(['https://cloudbilling.googleapis.com/v1/projects/p/billingInfo']);
  });

  it('keeps the service URL out of the repository: a Pages secret, not a wrangler.toml var', () => {
    const toml = readFileSync(join(ROOT, 'wrangler.toml'), 'utf8');
    expect(toml).not.toMatch(/^\s*LAB_COMPILE_URL\s*=/m);
    expect(toml).not.toMatch(/^\[vars\]/m);
    expect(joined).toContain('npx wrangler pages secret put LAB_COMPILE_URL --project-name vams');
    expect(joined).toMatch(/printf '%s' "\$URL" \| npx wrangler pages secret put LAB_COMPILE_URL/);
    expect(script).not.toMatch(/git add|Commit it/);
  });

  it('reads the limits back from gcloud run services describe', () => {
    const described = {
      spec: {
        template: {
          metadata: { annotations: { 'autoscaling.knative.dev/maxScale': '3' } },
          spec: { containerConcurrency: 2, timeoutSeconds: 30, containers: [{ resources: { limits: { cpu: '2', memory: '2Gi' } } }] },
        },
      },
    };
    expect(serviceLimits(described)).toEqual(SERVICE_LIMITS);
    // CPU allocated outside requests is billed by the instance, which the free allowance doesn't cover.
    described.spec.template.metadata.annotations['run.googleapis.com/cpu-throttling'] = 'false';
    expect(serviceLimits(described).cpuThrottling).toBe('false');
    expect(SERVICE_LIMITS.cpuThrottling).toBe('true');
  });

  it('puts the budget and its guard in place before anything that can be reached or charged', () => {
    const at = (needle: string) => {
      const i = joined.indexOf(needle);
      expect(i, needle).toBeGreaterThan(-1);
      return i;
    };
    const guarded = at('functions deploy "$GUARD"');
    expect(at('billing projects link')).toBeLessThan(at('g services enable'));
    expect(at('g services enable')).toBeLessThan(at('pubsub topics create'));
    expect(at('billing budgets create')).toBeLessThan(guarded);
    expect(at('--role=roles/run.invoker')).toBeGreaterThan(guarded);
    for (const later of ['docker build', 'run deploy "$SERVICE"', 'check-service', "-w '%{http_code}'"]) {
      expect(at(later), later).toBeGreaterThan(at('--role=roles/run.invoker'));
    }
  });

  it('builds the image for Cloud Run and keeps CPU billed per request', () => {
    expect(joined).toMatch(/docker build --platform linux\/amd64 /);
    const deploy = joined.split('\n').find((l) => l.includes('run deploy "$SERVICE"'))!;
    expect(deploy).toContain('--cpu-throttling');
    expect(deploy).not.toContain('--no-cpu-throttling');
  });

  it('prints no billing account or service URL for the repository', () => {
    const summary = script.slice(script.indexOf('say "Done'));
    expect(summary).not.toMatch(/BILLING_ACCOUNT|\$URL/);
  });
});
