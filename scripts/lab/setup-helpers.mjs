// Small steps of scripts/lab/setup-gcp.sh that are easier in Node.
//
//   node scripts/lab/setup-helpers.mjs guard <folder>      write the billing guard's deploy source
//   node scripts/lab/setup-helpers.mjs compile-url <url>   set LAB_COMPILE_URL in wrangler.toml
//   node scripts/lab/setup-helpers.mjs check-service       read `gcloud run services describe --format=json`
//                                                          on stdin and check the service's limits
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const GUARD = join(ROOT, 'lab/billing-guard');

/** The billing guard as plain JavaScript: Cloud Run functions load a .js entry. */
export const guardSource = () => stripTypeScriptTypes(readFileSync(join(GUARD, 'index.ts'), 'utf8'), { mode: 'strip' });

/** The guard's package.json, pointed at index.js. The runtime's own Node version applies, so engines goes. */
export function guardPackage() {
  const pkg = JSON.parse(readFileSync(join(GUARD, 'package.json'), 'utf8'));
  delete pkg.engines;
  return { ...pkg, main: 'index.js' };
}

export function writeGuard(folder) {
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, 'index.js'), guardSource());
  writeFileSync(join(folder, 'package.json'), `${JSON.stringify(guardPackage(), null, 2)}\n`);
}

/** wrangler.toml with LAB_COMPILE_URL set to `url`, keeping the file's line endings. */
export function withCompileUrl(toml, url) {
  if (!/^https:\/\/[A-Za-z0-9.-]+$/.test(url)) throw new Error(`not a service URL: ${url}`);
  const line = /^LAB_COMPILE_URL = "[^"\r\n]*"(\r?)$/m;
  if (!line.test(toml)) throw new Error('wrangler.toml has no LAB_COMPILE_URL line');
  return toml.replace(line, `LAB_COMPILE_URL = "${url}"$1`);
}

/** The limits the compile service must run with. */
export const SERVICE_LIMITS = { maxInstances: '3', minInstances: '0', concurrency: 2, cpu: '2', memory: '2Gi', timeout: 30 };

/** The limits a deployed service has, from `gcloud run services describe --format=json`. */
export function serviceLimits(service) {
  const template = service.spec.template;
  const annotations = template.metadata?.annotations ?? {};
  const limits = template.spec.containers[0].resources?.limits ?? {};
  return {
    maxInstances: annotations['autoscaling.knative.dev/maxScale'],
    minInstances: annotations['autoscaling.knative.dev/minScale'] ?? '0',
    concurrency: template.spec.containerConcurrency,
    cpu: limits.cpu,
    memory: limits.memory,
    timeout: template.spec.timeoutSeconds,
  };
}

function main([command, arg]) {
  if (command === 'guard' && arg) {
    writeGuard(resolve(arg));
    console.log(`billing guard written to ${resolve(arg)}`);
  } else if (command === 'compile-url' && arg) {
    const file = join(ROOT, 'wrangler.toml');
    const before = readFileSync(file, 'utf8');
    const after = withCompileUrl(before, arg);
    if (after === before) {
      console.log(`wrangler.toml already has LAB_COMPILE_URL = "${arg}"`);
    } else {
      writeFileSync(file, after);
      console.log(`wrangler.toml changed: LAB_COMPILE_URL = "${arg}". Commit it; the next Pages deploy picks it up.`);
    }
  } else if (command === 'check-service') {
    const found = serviceLimits(JSON.parse(readFileSync(0, 'utf8')));
    const wrong = Object.entries(SERVICE_LIMITS).filter(([k, v]) => found[k] !== v);
    console.log(`lab-compile: ${JSON.stringify(found)}`);
    if (wrong.length) {
      console.error(`limits differ from ${JSON.stringify(SERVICE_LIMITS)}: ${wrong.map(([k]) => k).join(', ')}`);
      process.exit(1);
    }
  } else {
    console.error('usage: setup-helpers.mjs guard <folder> | compile-url <url> | check-service');
    process.exit(2);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main(process.argv.slice(2));
