// The Lab's live checks, SEC-LAB-04 to SEC-LAB-10, against the deployed compile
// service. Each check prints one pass or fail line; --record adds them to the
// "Live checks" table in docs/lab-operations.md. This never runs in npm test.
//
//   node --experimental-strip-types scripts/lab/load-test.mjs --project <id> [--record]
//
// Options (or the environment variables after them):
//   --project <id>     the Google Cloud project             LAB_PROJECT
//                      With a project, the URL and the secret are read with gcloud,
//                      and SEC-LAB-07 and SEC-LAB-10 reach Firestore, Pub/Sub and
//                      Logging with gcloud's access token.
//   --url <url>        the Cloud Run service URL            LAB_COMPILE_URL
//   (the secret)       the service's shared secret          LAB_SECRET
//                      Only from the environment or gcloud, never on the command line.
//   --site <url>       send SEC-LAB-09 through the site's /api/compile instead, so
//                      the compiles come from this machine's IP
//   --only <ids>       comma-separated check ids
//   --record           append the results to docs/lab-operations.md
//   --lower-egress <bytes>  lower this month's egress counter by <bytes> and stop: the
//                      repair SEC-LAB-07 names if it could not put the counter back
//
// SEC-LAB-10 never touches billing. It first runs the guard's source in this
// process with a stand-in for Google, then publishes a message below the budget
// to the real budget topic and waits for the deployed guard's log line for it.
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { onBudget } from '../../lab/billing-guard/index.ts';
import { ALLOWANCE, monthKey, STOP_AT } from '../../lab/service/src/limits.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const REGION = 'us-central1';
export const OPERATIONS_DOC = join(ROOT, 'docs/lab-operations.md');
const BATTERY = join(ROOT, 'tests/fixtures/lab/programs');
/** A compile's download may be at most this many bytes, compressed. */
export const MAX_RESPONSE_BYTES = 100 * 1024;

/** The include probes of SEC-LAB-03. */
export const PROBES = [
  '#include "/etc/passwd"\nint main() {}',
  '#include </etc/passwd>\n',
  '%:include "../../../../etc/passwd"\n',
  '#include "/proc/self/environ"\n',
  '#include </proc/1/environ>\n',
  '#include "../../proc/self/environ"\n',
  '#define ENV </proc/self/environ>\n#include ENV\n',
  'const char e[] = {\n#embed "/proc/self/environ"\n};\n',
  '#if __has_include("/proc/self/environ")\n#endif\n',
];

/** Constant evaluation that runs for about 30 seconds, as in SEC-LAB-03. */
export const SPIN = [
  'constexpr long spin(long k) {',
  '  long s = 0;',
  '  for (long i = 0; i < 300000; i++) s += (i ^ k) & 7;',
  '  return s;',
  '}',
  'template <int N> struct Spin { static constexpr long value = spin(N) + Spin<N - 1>::value; };',
  'template <> struct Spin<0> { static constexpr long value = 0; };',
  'long total = Spin<1000>::value;',
].join('\n');

const TIMED_OUT = /^The compile took longer than \d+ seconds?, so it was stopped\.$/;

/** Used for SEC-LAB-08 and SEC-LAB-09 when the drawing battery isn't in the checkout. */
export const BUILT_IN = [
  {
    name: 'triangle',
    source: [
      '#include <GL/glut.h>',
      'void display() {',
      '  glClear(GL_COLOR_BUFFER_BIT);',
      '  glBegin(GL_TRIANGLES);',
      '  glColor3f(1, 0, 0); glVertex2f(-0.5f, -0.5f);',
      '  glColor3f(0, 1, 0); glVertex2f(0.5f, -0.5f);',
      '  glColor3f(0, 0, 1); glVertex2f(0, 0.5f);',
      '  glEnd();',
      '  glFlush();',
      '}',
      'int main(int argc, char **argv) {',
      '  glutInit(&argc, argv);',
      '  glutInitWindowSize(500, 500);',
      '  glutCreateWindow("Triangle");',
      '  glutDisplayFunc(display);',
      '  glutMainLoop();',
      '}',
    ].join('\n'),
  },
  {
    name: 'iostream',
    source: [
      '#include <iostream>',
      '#include <string>',
      '#include <vector>',
      'int main() {',
      '  std::vector<std::string> names = {"glBegin", "glVertex2f", "glEnd"};',
      '  for (const std::string &n : names) std::cout << n << " has " << n.size() << " letters\\n";',
      '}',
    ].join('\n'),
  },
];

/** The drawing battery's programs, or the built-in pair when it is missing. */
export function programs(folder = BATTERY) {
  if (!existsSync(folder)) return { from: 'built-in', list: BUILT_IN };
  const list = readdirSync(folder)
    .filter((f) => f.endsWith('.cpp'))
    .sort()
    .map((f) => ({ name: f.replace(/\.cpp$/, ''), source: readFileSync(join(folder, f), 'utf8') }));
  return list.length ? { from: 'battery', list } : { from: 'built-in', list: BUILT_IN };
}

/** A POST that returns the body exactly as sent, still gzip-encoded. */
export function send(url, { headers = {}, body = '' } = {}) {
  const u = new URL(url);
  const request = u.protocol === 'https:' ? httpsRequest : httpRequest;
  return new Promise((done, fail) => {
    const req = request(u, { method: 'POST', headers: { 'Content-Length': Buffer.byteLength(body), ...headers } }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const bytes = Buffer.concat(chunks);
        const type = String(res.headers['content-type'] ?? '');
        let json = null;
        if (type.startsWith('application/json')) {
          try {
            json = JSON.parse(bytes.toString('utf8'));
          } catch {
            json = null;
          }
        }
        done({ status: res.statusCode ?? 0, headers: res.headers, body: bytes, json });
      });
      res.on('error', fail);
    });
    req.on('error', fail);
    req.end(body);
  });
}

/** Everything a response told the client, as text: its body and its diagnostics header. */
const shown = (r) =>
  r.body.toString('latin1') + Buffer.from(String(r.headers['x-lab-diagnostics'] ?? ''), 'base64url').toString('utf8');

/** What one compile sent: the body as transferred and the diagnostics header. */
export const transferred = (r) => r.body.length + String(r.headers['x-lab-diagnostics'] ?? '').length;

function compiler(ctx) {
  let n = 0;
  return (source, { secret = ctx.secret, visitor = `lt-${ctx.run}-${++n}` } = {}) => {
    const headers = { 'Content-Type': 'application/json', 'X-Lab-Client-IP': ctx.ip };
    if (secret !== null) headers['X-Lab-Secret'] = secret;
    return send(`${ctx.url.replace(/\/+$/, '')}/compile`, { headers, body: JSON.stringify({ source, visitor }) });
  };
}

/** Cloud Run's own answer when every instance is busy, as opposed to the service's JSON refusals. */
const busy = (r) => (r.status === 429 || r.status === 502 || r.status === 503) && r.json === null;

/** Sends with the browser's busy retries: backoff for up to 60 seconds. */
async function withRetries(sendOnce, retries) {
  const started = Date.now();
  for (let wait = 500; ; wait = Math.min(wait * 2, 8000)) {
    const r = await sendOnce();
    if (!busy(r) || Date.now() - started > 60_000) return r;
    retries.count++;
    await new Promise((go) => setTimeout(go, wait));
  }
}

/** A Google API call with the signed-in account's token, billed to the project. */
async function googleCall(ctx, url, body) {
  const res = await ctx.fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ctx.token()}`, 'Content-Type': 'application/json', 'x-goog-user-project': ctx.project },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${new URL(url).host} answered ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

const firestoreCall = (ctx, method, body) =>
  googleCall(ctx, `https://firestore.googleapis.com/v1/projects/${ctx.project}/databases/(default)/documents:${method}`, body);

/** Adds `by` to the month's egress bytes, atomically, so concurrent compiles still count. */
const addEgress = (ctx, name, by) =>
  firestoreCall(ctx, 'commit', {
    writes: [
      {
        update: { name, fields: {} },
        updateMask: { fieldPaths: [] },
        updateTransforms: [{ fieldPath: 'egressBytes', increment: { integerValue: String(by) } }],
      },
    ],
  });

export const CHECKS = [
  {
    id: 'SEC-LAB-04',
    title: 'A request without the secret gets 401',
    needs: ['url'],
    async run(ctx) {
      const compile = compiler(ctx);
      const none = await compile('int main() {}', { secret: null });
      const wrong = await compile('int main() {}', { secret: `wrong-${randomBytes(8).toString('hex')}` });
      return { pass: none.status === 401 && wrong.status === 401, detail: `no secret: ${none.status}, wrong secret: ${wrong.status}` };
    },
  },
  {
    id: 'SEC-LAB-05',
    title: 'The include probes are refused',
    needs: ['url', 'secret'],
    async run(ctx) {
      const compile = compiler(ctx);
      const bad = [];
      for (const [i, source] of PROBES.entries()) {
        const r = await compile(source);
        const text = shown(r);
        const leaked = [ctx.secret, 'LAB_SECRET', 'root:'].some((s) => text.includes(s));
        if (r.status !== 422 || leaked) bad.push(`probe ${i + 1}: ${r.status}${leaked ? ', leaked' : ''}`);
      }
      return { pass: bad.length === 0, detail: bad.length ? bad.join('; ') : `${PROBES.length}/${PROBES.length} refused with 422, nothing leaked` };
    },
  },
  {
    id: 'SEC-LAB-06',
    title: 'A long compile is stopped at the time limit',
    needs: ['url', 'secret'],
    async run(ctx) {
      const started = Date.now();
      const r = await compiler(ctx)(SPIN);
      const took = Date.now() - started;
      const last = r.json?.diagnostics?.at(-1)?.message ?? '';
      const pass = r.status === 422 && TIMED_OUT.test(last) && took >= ctx.timeLimitMs && took < ctx.timeLimitMs + ctx.slackMs;
      return { pass, detail: `${r.status} after ${(took / 1000).toFixed(1)} s: ${last || 'no message'}` };
    },
  },
  {
    id: 'SEC-LAB-08',
    title: "Each program's response is at most 100 KB as transferred",
    needs: ['url', 'secret'],
    async run(ctx) {
      const compile = compiler(ctx);
      const { from, list } = ctx.programs;
      const bad = [];
      let largest = 0;
      for (const p of list) {
        const r = await compile(p.source);
        const bytes = transferred(r);
        largest = Math.max(largest, bytes);
        if (r.status !== 200 || bytes > MAX_RESPONSE_BYTES) bad.push(`${p.name}: ${r.status}, ${bytes} B`);
      }
      const kb = (largest / 1024).toFixed(1);
      return {
        pass: bad.length === 0,
        detail: bad.length ? bad.join('; ') : `${list.length} ${from} programs, largest ${kb} KB`,
      };
    },
  },
  {
    id: 'SEC-LAB-09',
    title: '40 compiles in 60 s from one IP, 40 visitors, all succeed',
    needs: ['url', 'secret'],
    async run(ctx) {
      const source = ctx.programs.list[0].source;
      const retries = { count: 0 };
      const viaSite = Boolean(ctx.site);
      const once = (i) => {
        const visitor = `lt-${ctx.run}-class-${i}`;
        if (!viaSite) return compiler(ctx)(source, { visitor });
        return send(`${ctx.site.replace(/\/+$/, '')}/api/compile`, {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source, visitor }),
        });
      };
      const statuses = [];
      let next = 0;
      const started = Date.now();
      // Six at a time: three instances with two compiles each.
      await Promise.all(
        Array.from({ length: 6 }, async () => {
          while (next < ctx.classSize) {
            const i = next++;
            statuses[i] = (await withRetries(() => once(i), retries)).status;
          }
        }),
      );
      const took = Date.now() - started;
      const ok = statuses.filter((s) => s === 200).length;
      return {
        pass: ok === ctx.classSize && took <= ctx.windowMs,
        detail: `${ok}/${ctx.classSize} succeeded in ${(took / 1000).toFixed(1)} s${viaSite ? ' through the site' : ''}, ${retries.count} busy retries`,
      };
    },
  },
  {
    id: 'SEC-LAB-07',
    title: 'At 80% of the month the next compile is 503 resting',
    needs: ['url', 'secret', 'project'],
    async run(ctx) {
      const month = monthKey(new Date());
      const name = `projects/${ctx.project}/databases/(default)/documents/usage/${month}`;
      const [found] = await firestoreCall(ctx, 'batchGet', { documents: [name] });
      const egress = Number(found?.found?.fields?.egressBytes?.integerValue ?? 0);
      const delta = Math.max(0, Math.ceil(STOP_AT * ALLOWANCE.egressBytes) - egress);
      // Lowered again only once the raise has committed, so a failed raise changes nothing.
      let raised = false;
      let r;
      let failed;
      try {
        await addEgress(ctx, name, delta);
        raised = true;
        r = await compiler(ctx)('int main() {}');
      } catch (e) {
        failed = e;
      }
      if (raised) {
        try {
          await addEgress(ctx, name, -delta);
        } catch (e) {
          return {
            pass: false,
            detail:
              `RESTORE FAILED (${e instanceof Error ? e.message : String(e)}): usage/${month} egressBytes is still ${delta} bytes high, ` +
              'so the Lab rests until it is lowered. Lower it with: ' +
              `node --experimental-strip-types scripts/lab/load-test.mjs --project ${ctx.project} --lower-egress ${delta}`,
          };
        }
      }
      if (failed) throw failed;
      return {
        pass: r.status === 503 && r.json?.resting === 'month',
        detail: `${r.status} ${JSON.stringify(r.json)}; counter restored (an instance may rest up to 60 s more)`,
      };
    },
  },
  {
    id: 'SEC-LAB-10',
    title: 'The deployed guard reads a budget message from the budget topic',
    needs: ['project'],
    async run(ctx) {
      // First the guard's own source, in this process, with a stand-in for Google: it must
      // switch billing off at 100% and leave it on below. Only then does a message go live.
      const pre = await guardDryRun(ctx.project);
      if (!pre.pass) return { pass: false, detail: `in-process pre-check failed: ${pre.detail}` };

      // A message below the budget, in the shape Cloud Billing sends, so the deployed guard
      // logs and leaves billing on. Its name is unique to this run, so only this run's line counts.
      const name = `vams-lab live check ${ctx.run}`;
      const now = new Date();
      const message = {
        budgetDisplayName: name,
        alertThresholdExceeded: 0.5,
        costAmount: 0.5,
        costIntervalStart: `${monthKey(now)}-01T07:00:00Z`,
        budgetAmount: 1,
        budgetAmountType: 'SPECIFIED_AMOUNT',
        currencyCode: 'USD',
      };
      const want = `Budget ${name} not reached (0.5 of 1): billing stays on.`;
      // A minute early, so a local clock running ahead of Google's can't hide the line;
      // the run's own budget name keeps older lines out.
      const since = new Date(Date.now() - 60_000).toISOString();
      await googleCall(ctx, `https://pubsub.googleapis.com/v1/projects/${ctx.project}/topics/budget:publish`, {
        messages: [{ data: Buffer.from(JSON.stringify(message)).toString('base64'), attributes: { schemaVersion: '1.0' } }],
      });
      const filter = [
        'resource.type="cloud_run_revision"',
        'resource.labels.service_name="billing-guard"',
        `timestamp>="${since}"`,
        // A bare string matches any field, so a line logged as text or as structured JSON is found.
        `"${name}"`,
      ].join(' AND ');
      const started = Date.now();
      for (;;) {
        const listed = await googleCall(ctx, 'https://logging.googleapis.com/v2/entries:list', {
          resourceNames: [`projects/${ctx.project}`],
          filter,
          orderBy: 'timestamp desc',
          pageSize: 20,
        });
        const lines = (listed.entries ?? []).map((e) => String(e.textPayload ?? e.jsonPayload?.message ?? '').trim());
        if (lines.includes(want)) {
          const waited = ((Date.now() - started) / 1000).toFixed(0);
          return { pass: true, detail: `pre-check passed; published to budget, and the guard logged "${want}" within ${waited} s` };
        }
        if (Date.now() - started >= ctx.logWaitMs) break;
        await new Promise((go) => setTimeout(go, ctx.logPollMs));
      }
      return {
        pass: false,
        detail: `pre-check passed; published to budget, but the guard logged no "${want}" within ${ctx.logWaitMs / 1000} s`,
      };
    },
  },
];

/**
 * The guard from lab/billing-guard/index.ts, run here with a fetch that answers for Google:
 * a message at 100% must send one PUT that empties the billing account, and one at 50% none.
 * Any other address is refused, so nothing leaves this process.
 */
export async function guardDryRun(project) {
  const billingInfo = `https://cloudbilling.googleapis.com/v1/projects/${project}/billingInfo`;
  const run = async (message) => {
    const sent = [];
    const fakeFetch = async (url, init = {}) => {
      const u = String(url);
      const method = init.method ?? 'GET';
      sent.push({ url: u, method, body: init.body });
      if (u.endsWith('/instance/service-accounts/default/token')) return Response.json({ access_token: 'dry-run' });
      if (u === billingInfo && method === 'GET') return Response.json({ billingEnabled: true });
      if (u === billingInfo && method === 'PUT') return Response.json({ billingEnabled: false });
      throw new Error(`the dry run sends nothing to ${u}`);
    };
    const event = { data: { message: { data: Buffer.from(JSON.stringify(message)).toString('base64') } } };
    const logged = [];
    const log = console.log;
    console.log = (...args) => logged.push(args.join(' '));
    try {
      await onBudget(event, { fetch: fakeFetch, env: { GOOGLE_CLOUD_PROJECT: project } });
    } finally {
      console.log = log;
    }
    return { puts: sent.filter((c) => c.method === 'PUT'), logged };
  };
  const over = await run({ budgetDisplayName: 'vams-lab', costAmount: 1, budgetAmount: 1, alertThresholdExceeded: 1, currencyCode: 'USD' });
  const below = await run({ budgetDisplayName: 'vams-lab', costAmount: 0.5, budgetAmount: 1, alertThresholdExceeded: 0.5, currencyCode: 'USD' });
  const pass =
    over.puts.length === 1 &&
    over.puts[0].url === billingInfo &&
    over.puts[0].body === '{"billingAccountName":""}' &&
    over.logged.includes(`Billing turned off for ${project}.`) &&
    below.puts.length === 0 &&
    below.logged.includes('Budget vams-lab not reached (0.5 of 1): billing stays on.');
  const said = (r) => r.logged.join(' / ') || 'nothing';
  return { pass, detail: `at 100%: ${over.puts.length} PUT, logged ${said(over)}; at 50%: ${below.puts.length} PUT, logged ${said(below)}` };
}

/** Runs the checks in order, printing a line for each. A check that throws fails. */
export async function runChecks(ctx, ids = CHECKS.map((c) => c.id)) {
  const results = [];
  for (const check of CHECKS.filter((c) => ids.includes(c.id))) {
    const missing = check.needs.filter((k) => !ctx[k]);
    let result;
    const started = Date.now();
    if (missing.length) {
      result = { pass: false, detail: `skipped: needs ${missing.join(', ')}` };
    } else {
      try {
        result = await check.run(ctx);
      } catch (e) {
        result = { pass: false, detail: `threw: ${e instanceof Error ? e.message : String(e)}` };
      }
    }
    const line = { id: check.id, title: check.title, ...result, ms: Date.now() - started };
    ctx.log(`${line.pass ? 'PASS' : 'FAIL'} ${line.id} ${line.title}: ${line.detail}`);
    results.push(line);
  }
  return results;
}

/** The context the checks run in, with the defaults filled in. */
export function context(options = {}) {
  return {
    run: randomBytes(4).toString('hex'),
    ip: `load-test-${randomBytes(4).toString('hex')}`,
    fetch: globalThis.fetch,
    token: () => '',
    log: console.log,
    timeLimitMs: 10_000,
    slackMs: 10_000,
    classSize: 40,
    windowMs: 60_000,
    // How long SEC-LAB-10 waits for the guard's log line, and how often it looks.
    logWaitMs: 180_000,
    logPollMs: 10_000,
    programs: programs(),
    ...options,
  };
}

/** Lowers this month's egress counter by `bytes`: the repair for a SEC-LAB-07 that could not restore it. */
export async function lowerEgress(ctx, bytes) {
  const name = `projects/${ctx.project}/databases/(default)/documents/usage/${monthKey(new Date())}`;
  await addEgress(ctx, name, -bytes);
}

/** The doc with the results added as rows at the end of the Live checks table. */
export function recordResults(doc, results, when) {
  const eol = doc.includes('\r\n') ? '\r\n' : '\n';
  const lines = doc.split(/\r?\n/);
  const heading = lines.findIndex((l) => /^##\s+Live checks\s*$/.test(l));
  if (heading < 0) throw new Error('the doc has no "## Live checks" section');
  let header = heading + 1;
  while (header < lines.length && !lines[header].startsWith('|')) {
    if (/^##\s/.test(lines[header])) throw new Error('the Live checks section has no table');
    header++;
  }
  let end = header + 2;
  while (end < lines.length && lines[end].startsWith('|')) end++;
  const cell = (s) => String(s).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
  const rows = results.map((r) => `| ${r.id} | ${r.pass ? 'pass' : 'fail'} | ${cell(r.detail)} | ${when} |`);
  lines.splice(end, 0, ...rows);
  return lines.join(eol);
}

const gcloud = (args) =>
  execFileSync(process.platform === 'win32' ? 'gcloud.cmd' : 'gcloud', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
    shell: process.platform === 'win32',
  }).trim();

async function main() {
  const { values } = parseArgs({
    options: {
      url: { type: 'string' },
      project: { type: 'string' },
      site: { type: 'string' },
      only: { type: 'string' },
      record: { type: 'boolean' },
      'lower-egress': { type: 'string' },
    },
  });
  const project = values.project ?? process.env.LAB_PROJECT ?? '';
  let url = values.url ?? process.env.LAB_COMPILE_URL ?? '';
  let secret = process.env.LAB_SECRET ?? '';
  let token = '';
  const accessToken = () => (token ||= gcloud(['auth', 'print-access-token']));
  if (values['lower-egress'] !== undefined) {
    const bytes = Number(values['lower-egress']);
    if (!project || !Number.isSafeInteger(bytes) || bytes <= 0) throw new Error('--lower-egress needs --project and a whole number of bytes');
    await lowerEgress(context({ project, token: accessToken }), bytes);
    console.log(`lowered usage/${monthKey(new Date())} egressBytes by ${bytes}`);
    return;
  }
  if (project && !url) {
    url = gcloud(['run', 'services', 'describe', 'lab-compile', `--region=${REGION}`, `--project=${project}`, '--format=value(status.url)']);
  }
  if (project && !secret) {
    secret = gcloud(['secrets', 'versions', 'access', 'latest', '--secret=lab-secret', `--project=${project}`]);
  }
  const ctx = context({ url, secret, project, site: values.site ?? '', token: accessToken });
  const ids = values.only ? values.only.split(',').map((s) => s.trim()) : undefined;
  const unknown = (ids ?? []).filter((id) => !CHECKS.some((c) => c.id === id));
  if (unknown.length) throw new Error(`no such check: ${unknown.join(', ')}`);
  const results = await runChecks(ctx, ids);
  if (values.record) {
    const when = new Date().toISOString().slice(0, 10);
    writeFileSync(OPERATIONS_DOC, recordResults(readFileSync(OPERATIONS_DOC, 'utf8'), results, when));
    console.log(`recorded ${results.length} results in docs/lab-operations.md`);
  }
  process.exit(results.every((r) => r.pass) ? 0 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
