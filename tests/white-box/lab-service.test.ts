/**
 * WHITE-BOX TEST SUITE — WB-LAB (the compile service)
 * The Lab's compile service in lab/service/src: how clang's messages reach the student,
 * the flags it compiles with, and its HTTP contract.
 *
 * Test focus:
 *  - A rejected or undeclared GL name gives the VAMS message on its line
 *  - Notes and errors inside headers never show a server path
 *  - The flags match lab/runtime/build.sh word for word
 *  - POST /compile answers 200, 422, 503, 429 and 401 as the contract says, two compiles at a time
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { connect, type AddressInfo } from 'node:net';
import { request as httpRequest, type Server } from 'node:http';
import { includeTrace, rewriteDiagnostics, scrubPaths, type Diagnostic } from '../../lab/service/src/diagnostics.ts';
import { sideFlags, traceIsInside } from '../../lab/service/src/compile.ts';
import {
  createService,
  DIAGNOSTICS_HEADER_BYTES,
  encodeDiagnostics,
  type ServiceOptions,
} from '../../lab/service/src/server.ts';
import type { Reservation, UsageStore } from '../../lab/service/src/usage.ts';
import type { CompileResult } from '../../lab/service/src/compile.ts';
import { labRequest } from '../helpers/lab-http';

const SPEC_MESSAGE = "main.cpp:12:5: gluPerspective isn't part of VAMS Lab's OpenGL. Use glOrtho or gluOrtho2D.";
const shown = (d: Diagnostic) => `${d.file}:${d.line}:${d.col}: ${d.message}`;

describe('WB-LAB-01: A rejected or undeclared GL name gives the VAMS message on its line', () => {
  it("maps clang's unavailable error to the spec's exact message", () => {
    const out = rewriteDiagnostics(
      "main.cpp:12:5: error: 'gluPerspective' is unavailable: gluPerspective isn't part of VAMS Lab's OpenGL. Use glOrtho or gluOrtho2D.\n" +
        "/lab/include/vams_rejected.h:20:13: note: 'gluPerspective' has been explicitly marked unavailable here\n" +
        '1 error generated.\n',
    );
    expect(out).toEqual([
      {
        file: 'main.cpp',
        line: 12,
        col: 5,
        severity: 'error',
        message: "gluPerspective isn't part of VAMS Lab's OpenGL. Use glOrtho or gluOrtho2D.",
      },
    ]);
    expect(shown(out[0])).toBe(SPEC_MESSAGE);
  });

  it.each([
    ['glLightfv', "use of undeclared identifier 'glLightfv'"],
    ['GL_DEPTH_TEST', "use of undeclared identifier 'GL_DEPTH_TEST'"],
    ['GL_LIGHTING', "use of undeclared identifier 'GL_LIGHTING'"],
    ['gluSphere', "use of undeclared identifier 'gluSphere'"],
    ['glutStrokeCharacter', "use of undeclared identifier 'glutStrokeCharacter'"],
    ['GLUT_STROKE_ROMAN', "use of undeclared identifier 'GLUT_STROKE_ROMAN'"],
    ['glewIsSupported', "use of undeclared identifier 'glewIsSupported'"],
    ['GLU_FILL', "use of undeclared identifier 'GLU_FILL'"],
    ['GLUquadric', "unknown type name 'GLUquadric'"],
  ])('turns an undeclared %s into the VAMS message', (name, clang) => {
    const [d] = rewriteDiagnostics(`main.cpp:5:14: error: ${clang}\n`);
    expect(d).toEqual({ file: 'main.cpp', line: 5, col: 14, severity: 'error', message: `${name} isn't part of VAMS Lab's OpenGL.` });
  });

  it('leaves other diagnostics as clang wrote them', () => {
    const stderr = [
      "main.cpp:3:5: error: use of undeclared identifier 'score'",
      "main.cpp:4:9: error: use of undeclared identifier 'global'",
      "main.cpp:7:17: error: expected ';' after expression",
      "main.cpp:9:9: warning: unused variable 'x' [-Wunused-variable]",
      "main.cpp:11:3: error: unknown type name 'Sprite'",
      '2 warnings and 3 errors generated.',
    ].join('\n');
    expect(rewriteDiagnostics(stderr).map((d) => `${d.line}:${d.col}: ${d.severity}: ${d.message}`)).toEqual([
      "3:5: error: use of undeclared identifier 'score'",
      "4:9: error: use of undeclared identifier 'global'",
      "7:17: error: expected ';' after expression",
      "9:9: warning: unused variable 'x' [-Wunused-variable]",
      "11:3: error: unknown type name 'Sprite'",
    ]);
  });

  it('keeps only the VAMS message when a rejected function is taken as a value', () => {
    // Clang's output for `void (*f)(double) = glutSolidCube;` on line 11.
    const stderr = [
      "main.cpp:11:12: error: cannot initialize a variable of type 'void (*)(double)' with an lvalue of type 'void (...)': different number of parameters (1 vs 0)",
      "main.cpp:11:25: error: 'glutSolidCube' is unavailable: glutSolidCube isn't part of VAMS Lab's OpenGL. Use glRectf or glBegin(GL_QUADS).",
      "/lab/include/vams_rejected.h:46:13: note: 'glutSolidCube' has been explicitly marked unavailable here",
      "main.cpp:12:5: error: use of undeclared identifier 'score'",
    ].join('\n');
    expect(rewriteDiagnostics(stderr).map(shown)).toEqual([
      "main.cpp:11:25: glutSolidCube isn't part of VAMS Lab's OpenGL. Use glRectf or glBegin(GL_QUADS).",
      "main.cpp:12:5: use of undeclared identifier 'score'",
    ]);
  });
});

describe('WB-LAB-02: Notes inside the bundled headers are dropped, and no message names a server path', () => {
  // Clang's output for std::sort(v.begin(), v.end(), 5) on line 12, shortened.
  const sortError = [
    'In file included from main.cpp:2:',
    'In file included from /lab/sysroot/include/c++/v1/vector:352:',
    'In file included from /lab/sysroot/include/c++/v1/algorithm:1868:',
    '/lab/sysroot/include/c++/v1/__algorithm/sift_down.h:47:32: error: called object type \'int\' is not a function or function pointer',
    "/lab/sysroot/include/c++/v1/__algorithm/make_heap.h:39:12: note: in instantiation of function template specialization 'std::__sift_down<std::_ClassicAlgPolicy, int &, int *>' requested here",
    "main.cpp:12:30: note: in instantiation of function template specialization 'std::sort<std::__wrap_iter<int *>, int>' requested here",
    "/lab/sysroot/include/c++/v1/__algorithm/sift_down.h:54:7: error: called object type 'int' is not a function or function pointer",
    "/lab/sysroot/include/c++/v1/__algorithm/sort.h:101:1: note: candidate template ignored: requirement '__use_branchless_sort<int &, int *>' was not satisfied",
    'fatal error: too many errors emitted, stopping now [-ferror-limit=]',
    '20 errors generated.',
  ].join('\n');

  it('drops notes that point into /lab/include', () => {
    const out = rewriteDiagnostics(
      "main.cpp:6:5: error: 'gluLookAt' is unavailable: gluLookAt isn't part of VAMS Lab's OpenGL. Use glTranslatef and glRotatef.\n" +
        "/lab/include/vams_rejected.h:22:13: note: 'gluLookAt' has been explicitly marked unavailable here\n" +
        "/lab/include/GL/glu.h:30:6: note: candidate function not viable\n",
    );
    expect(out.map((d) => d.severity)).toEqual(['error']);
  });

  it("places an error inside a header on the main.cpp line that led there, without the header's path", () => {
    const out = rewriteDiagnostics(sortError);
    expect(out.map((d) => `${d.line}:${d.col}: ${d.severity}: ${d.message}`)).toEqual([
      "12:30: error: called object type 'int' is not a function or function pointer",
      "12:30: note: in instantiation of function template specialization 'std::sort<std::__wrap_iter<int *>, int>' requested here",
      '12:30: error: too many errors emitted, stopping now [-ferror-limit=]',
    ]);
  });

  it('places an error in an included header on its #include line', () => {
    const out = rewriteDiagnostics(
      'In file included from main.cpp:3:\nIn file included from /lab/include/GL/freeglut.h:17:\n' +
        "/lab/include/GL/gl.h:120:1: error: expected unqualified-id\n",
    );
    expect(out).toEqual([{ file: 'main.cpp', line: 3, col: 1, severity: 'error', message: 'expected unqualified-id' }]);
  });

  it("drops clang's header list, its summary line and a crash's stack dump", () => {
    const out = rewriteDiagnostics(
      [
        '. /lab/include/GL/freeglut.h',
        '.. /lab/include/GL/freeglut_std.h',
        "main.cpp:4:1: error: unknown type name 'foo'",
        'PLEASE submit a bug report to https://github.com/llvm/llvm-project/issues/ and include the crash backtrace.',
        'Stack dump:',
        '0.\tProgram arguments: /opt/llvm/bin/clang++ -cc1 -isystem /lab/include main.cpp',
        ' #0 0x000055d0 llvm::sys::PrintStackTrace (/opt/llvm/bin/clang+0x1234)',
        'clang++: error: clang frontend command failed with exit code 139 (use -v to see invocation)',
        'InstalledDir: /opt/llvm/bin',
        '1 error generated.',
      ].join('\n'),
    );
    expect(out.map((d) => d.message)).toEqual([
      "unknown type name 'foo'",
      'clang frontend command failed with exit code 139 (use -v to see invocation)',
    ]);
  });

  it('never names a server path in any message', () => {
    const stderr = [
      sortError,
      "main.cpp:2:10: fatal error: '/lab/include/GL/missing.h' file not found",
      'wasm-ld: error: /tmp/vams-a1b2c3/main.o: section too large',
      "main.cpp:9:3: warning: '/opt/llvm/lib/clang/21/include/stddef.h' is odd",
    ].join('\n');
    const out = rewriteDiagnostics(stderr);
    expect(out.length).toBeGreaterThan(3);
    for (const d of out) {
      expect(d.file).toBe('main.cpp');
      expect(d.message).not.toMatch(/\/(lab|tmp|opt|etc|proc|usr|home)\b/);
    }
    expect(out.map((d) => d.message)).toContain("'GL/missing.h' file not found");
    expect(out.map((d) => d.message)).toContain('main.o: section too large');
  });

  it('scrubs paths but leaves the rest of a message alone', () => {
    expect(scrubPaths("invalid operands to binary expression ('int' and 'std::string')")).toBe(
      "invalid operands to binary expression ('int' and 'std::string')",
    );
    expect(scrubPaths('cannot open /etc/passwd for reading')).toBe('cannot open passwd for reading');
    expect(scrubPaths("in '/lab/sysroot/include/c++/v1/vector'")).toBe("in 'vector'");
  });

  it('accepts a header list inside the bundled headers, the sysroot and clang, and nothing else', () => {
    const paths = { include: '/lab/include', sysroot: '/lab/sysroot', llvmBin: '/opt/llvm/bin' };
    const inside = ['/lab/include/GL/freeglut.h', '/lab/sysroot/include/c++/v1/vector', '/opt/llvm/lib/clang/21/include/stddef.h'];
    expect(traceIsInside(inside, paths)).toBe(true);
    expect(traceIsInside([...inside, '/etc/passwd'], paths)).toBe(false);
    expect(traceIsInside(['/lab/include/../../etc/passwd'], paths)).toBe(false);
    expect(traceIsInside(['/lab/includes/x.h'], paths)).toBe(false);
  });

  it('reads every line of the header list as a path, and refuses any that is not absolute', () => {
    const paths = { include: '/lab/include', sysroot: '/lab/sysroot', llvmBin: '/opt/llvm/bin' };
    const trace = includeTrace('. /lab/include/GL/gl.h\n.. GL/glu.h\n... ./main.cpp\nmain.cpp:1:1: error: x\n');
    expect(trace).toEqual(['/lab/include/GL/gl.h', 'GL/glu.h', './main.cpp']);
    expect(traceIsInside(trace.slice(0, 1), paths)).toBe(true);
    expect(traceIsInside(['GL/glu.h'], paths)).toBe(false);
    expect(traceIsInside(['./main.cpp'], paths)).toBe(false);
    expect(traceIsInside(['lab/include/GL/gl.h'], paths)).toBe(false);
    expect(rewriteDiagnostics('.. GL/glu.h\n').length).toBe(0);
  });
});

/** Expands the variable assignments in a POSIX sh script, the way sh would for these simple forms. */
function shellVariables(script: string): Map<string, string> {
  const vars = new Map<string, string>();
  const expand = (s: string) =>
    s.replace(/\$\{(\w+)(?::-([^}]*))?\}|\$(\w+)/g, (_m, a: string, def: string | undefined, b: string) => {
      const name = a ?? b;
      return vars.get(name) ?? def ?? '';
    });
  for (const line of script.split(/\r?\n/)) {
    const m = /^([A-Z_][A-Z0-9_]*)=(?:"([^"]*)"|(\$\{[^}]*\}))\s*$/.exec(line);
    if (m) vars.set(m[1], expand(m[2] ?? m[3]));
  }
  return vars;
}

describe('WB-LAB-13: The service compiles with the flags lab/runtime/build.sh holds', () => {
  const script = readFileSync(join(process.cwd(), 'lab/runtime/build.sh'), 'utf8');
  const vars = shellVariables(script);
  const words = (name: string) => (vars.get(name) ?? '').split(/\s+/).filter(Boolean);

  it('reads the default paths from build.sh', () => {
    expect(vars.get('LAB_INCLUDE')).toBe('/lab/include');
    expect(vars.get('LAB_SYSROOT')).toBe('/lab/sysroot');
  });

  it('matches SIDE_CC_FLAGS, SIDE_LD_FLAGS and SIDE_STRIP_FLAGS word for word', () => {
    const flags = sideFlags('/lab/include', '/lab/sysroot');
    expect(words('SIDE_CC_FLAGS').length).toBeGreaterThan(20);
    expect(flags.cc).toEqual(words('SIDE_CC_FLAGS'));
    expect(flags.ld).toEqual(words('SIDE_LD_FLAGS'));
    expect(flags.strip).toEqual(words('SIDE_STRIP_FLAGS'));
  });

  it('puts the given paths where build.sh puts LAB_INCLUDE and LAB_SYSROOT', () => {
    const flags = sideFlags('/w/include', '/s');
    expect(flags.cc).toContain('--sysroot=/s');
    expect(flags.cc.join(' ')).toContain('-isystem /w/include -isystem /s/include/c++/v1');
  });
});

describe('WB-LAB-14: POST /compile follows the HTTP contract, two compiles at a time', () => {
  const SECRET = 'test-secret-7f3a';
  const okResult = (diagnostics: Diagnostic[] = []): CompileResult => ({
    ok: true,
    module: new Uint8Array([0, 0x61, 0x73, 0x6d, 1, 0, 0, 0]),
    diagnostics,
    ms: 5,
  });
  let server: Server | null = null;

  afterEach(async () => {
    await new Promise<void>((done) => (server ? server.close(() => done()) : done()));
    server = null;
  });

  async function start(options: Partial<ServiceOptions> = {}): Promise<string> {
    server = createService({ secret: SECRET, compile: async () => okResult(), ...options });
    await new Promise<void>((done) => server!.listen(0, '127.0.0.1', () => done()));
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}/compile`;
  }
  const post = (url: string, body: unknown, headers: Record<string, string> = {}) =>
    labRequest(url, {
      headers: { 'Content-Type': 'application/json', 'X-Lab-Secret': SECRET, 'X-Lab-Client-IP': '203.0.113.7', ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
  const request = { source: 'int main() {}', visitor: 'v-123' };

  it('refuses a request without the secret, or with the wrong one, with 401', async () => {
    let compiled = 0;
    const url = await start({ compile: async () => (compiled++, okResult()) });
    const none = await labRequest(url, { body: JSON.stringify(request), headers: { 'X-Lab-Client-IP': '203.0.113.7' } });
    expect(none.status).toBe(401);
    expect((await post(url, request, { 'X-Lab-Secret': 'wrong' })).status).toBe(401);
    expect((await post(url, request, { 'X-Lab-Secret': `${SECRET}x` })).status).toBe(401);
    expect(compiled).toBe(0);
  });

  it('returns the module gzip-encoded as application/wasm, with the diagnostics in X-Lab-Diagnostics', async () => {
    const warning: Diagnostic = { file: 'main.cpp', line: 3, col: 9, severity: 'warning', message: "unused variable 'x'" };
    const url = await start({ compile: async () => okResult([warning]) });
    const res = await post(url, request);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/wasm');
    expect(res.headers['content-encoding']).toBe('gzip');
    expect([...gunzipSync(res.body)]).toEqual([0, 0x61, 0x73, 0x6d, 1, 0, 0, 0]);
    const header = res.headers['x-lab-diagnostics'] as string;
    expect(JSON.parse(Buffer.from(header, 'base64url').toString('utf8'))).toEqual([warning]);
  });

  it('keeps X-Lab-Diagnostics within 8 KB, ending with a note that says how many were left out', () => {
    const many: Diagnostic[] = Array.from({ length: 300 }, (_, i) => ({
      file: 'main.cpp', line: i + 1, col: 1, severity: 'warning', message: `unused variable 'value_${i}' [-Wunused-variable]`,
    }));
    const value = encodeDiagnostics(many);
    expect(value.length).toBeLessThanOrEqual(DIAGNOSTICS_HEADER_BYTES);
    expect(value).toMatch(/^[A-Za-z0-9_-]+$/);
    const back = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Diagnostic[];
    const note = back.at(-1)!;
    expect(note.severity).toBe('note');
    expect(back.slice(0, -1)).toEqual(many.slice(0, back.length - 1));
    expect(note.message).toBe(`${many.length - (back.length - 1)} more messages were left out.`);
    expect(encodeDiagnostics(many.slice(0, 2))).toBe(Buffer.from(JSON.stringify(many.slice(0, 2))).toString('base64url'));
  });

  it('keeps as many diagnostics as fit, in time linear in their number', () => {
    const make = (n: number): Diagnostic[] =>
      Array.from({ length: n }, (_, i) => ({
        file: 'main.cpp', line: i + 1, col: 1, severity: 'warning', message: `unused variable 'ñ_${i}'`.repeat(1 + (i % 3)),
      }));
    // Fits exactly: the largest prefix whose encoding, with the note, is within 8 KB.
    const some = make(400);
    const value = encodeDiagnostics(some);
    const back = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Diagnostic[];
    const kept = back.length - 1;
    const encoded = (k: number) => {
      const left = some.length - k;
      const note = { file: 'main.cpp', line: some[k - 1]?.line ?? 1, col: 1, severity: 'note', message: `${left} more message${left === 1 ? ' was' : 's were'} left out.` };
      return Buffer.from(JSON.stringify([...some.slice(0, k), note])).toString('base64url');
    };
    expect(value).toBe(encoded(kept));
    expect(value.length).toBeLessThanOrEqual(DIAGNOSTICS_HEADER_BYTES);
    expect(encoded(kept + 1).length).toBeGreaterThan(DIAGNOSTICS_HEADER_BYTES);

    const started = performance.now();
    const big = encodeDiagnostics(make(5000));
    expect(performance.now() - started).toBeLessThan(500);
    expect(big.length).toBeLessThanOrEqual(DIAGNOSTICS_HEADER_BYTES);
  });

  it('sets explicit limits for reading a request', () => {
    const s = createService({ secret: SECRET });
    expect(s.headersTimeout).toBe(10_000);
    expect(s.requestTimeout).toBe(30_000);
  });

  it('stops a compile whose client has gone, so its slot frees at once', async () => {
    let started = 0;
    const stopped: boolean[] = [];
    const url = await start({
      concurrency: 1,
      compile: async (_source, opts) => {
        started++;
        if (started === 1) {
          // The first compile runs until it is told to stop.
          await new Promise<void>((go) => opts.signal?.addEventListener('abort', () => go()));
          stopped.push(opts.signal?.aborted ?? false);
          return { ok: false, diagnostics: [], ms: 1 };
        }
        return okResult();
      },
    });
    const gone = httpRequest(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Lab-Secret': SECRET, 'X-Lab-Client-IP': '203.0.113.7' },
    });
    gone.on('error', () => {});
    gone.end(JSON.stringify(request));
    await expect.poll(() => started).toBe(1);
    gone.destroy();
    await expect.poll(() => stopped).toEqual([true]);
    const next = await post(url, request);
    expect(next.status).toBe(200);
    expect(started).toBe(2);
  });

  it('answers a compile error with 422 and the diagnostics', async () => {
    const error: Diagnostic = { file: 'main.cpp', line: 12, col: 5, severity: 'error', message: "gluPerspective isn't part of VAMS Lab's OpenGL. Use glOrtho or gluOrtho2D." };
    const url = await start({ compile: async () => ({ ok: false, diagnostics: [error], ms: 3 }) });
    const res = await post(url, request);
    expect(res.status).toBe(422);
    expect(res.headers['content-type']).toMatch(/^application\/json/);
    expect(JSON.parse(res.text)).toEqual({ diagnostics: [error] });
  });

  it.each([
    [{ ok: false, reason: 'month' } as const, 503, { resting: 'month' }],
    [{ ok: false, reason: 'day' } as const, 503, { resting: 'day' }],
    [{ ok: false, reason: 'visitor' } as const, 429, { limit: 'visitor' }],
    [{ ok: false, reason: 'ip' } as const, 429, { limit: 'ip' }],
  ])('answers %o with %i', async (reservation, status, body) => {
    let compiled = 0;
    let settled = 0;
    const seen: { visitor: string; ip: string }[] = [];
    const usage: UsageStore = {
      reserve: async ({ visitor, ip }) => (seen.push({ visitor, ip }), reservation),
      settle: async () => void settled++,
    };
    const url = await start({ usage, compile: async () => (compiled++, okResult()) });
    const res = await post(url, request);
    expect(res.status).toBe(status);
    expect(JSON.parse(res.text)).toEqual(body);
    expect(seen).toEqual([{ visitor: 'v-123', ip: '203.0.113.7' }]);
    expect(compiled).toBe(0);
    expect(settled).toBe(0);
  });

  it("reserves before compiling, and settles after with the response's bytes and the compile's ms", async () => {
    const events: string[] = [];
    const settles: { bytes: number; ms: number }[] = [];
    const usage: UsageStore = {
      reserve: async ({ now }) => (events.push(`reserve ${now instanceof Date}`), { ok: true }),
      settle: async ({ bytes, ms, now }) => {
        events.push(`settle ${now instanceof Date}`);
        settles.push({ bytes, ms });
      },
    };
    const error: Diagnostic = { file: 'main.cpp', line: 2, col: 1, severity: 'error', message: "expected ';'" };
    let fail = false;
    const url = await start({
      usage,
      compile: async () => (events.push('compile'), fail ? { ok: false, diagnostics: [error], ms: 7 } : okResult()),
    });
    const ok = await post(url, request);
    expect(events).toEqual(['reserve true', 'compile', 'settle true']);
    const sent = ok.body.length + String(ok.headers['x-lab-diagnostics']).length;
    expect(settles[0]).toEqual({ bytes: sent, ms: 5 });

    fail = true;
    const failed = await post(url, request);
    expect(failed.status).toBe(422);
    expect(settles[1]).toEqual({ bytes: failed.body.length, ms: 7 });
  });

  it('answers 500 and compiles nothing when the usage store fails', async () => {
    let compiled = 0;
    const usage: UsageStore = {
      reserve: async () => {
        throw new Error('Firestore is unreachable.');
      },
      settle: async () => {},
    };
    const url = await start({ usage, compile: async () => (compiled++, okResult()) });
    expect((await post(url, request)).status).toBe(500);
    expect(compiled).toBe(0);
  });

  it("logs a failed request's message, and never its stack", async () => {
    const logged: unknown[][] = [];
    const spy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => void logged.push(args));
    try {
      const usage: UsageStore = {
        reserve: async () => {
          throw new Error('Firestore is unreachable.');
        },
        settle: async () => {},
      };
      const url = await start({ usage });
      expect((await post(url, request)).status).toBe(500);
      expect(logged).toEqual([['compile request failed:', 'Firestore is unreachable.']]);
    } finally {
      spy.mockRestore();
    }
  });

  it('reserves nothing for a client that has gone before its reserve', async () => {
    let reserved = 0;
    let compiled = 0;
    const usage: UsageStore = { reserve: async () => (reserved++, { ok: true }), settle: async () => {} };
    const url = new URL(await start({ usage, compile: async () => (compiled++, okResult()) }));
    const body = JSON.stringify(request);
    const CRLF = String.fromCharCode(13, 10);
    for (let i = 0; i < 5; i++) {
      // The whole request, then the client leaves at once: its body has ended, and so has it.
      await new Promise<void>((done) => {
        const socket = connect(Number(url.port), url.hostname, () => {
          socket.write(
            [
              'POST /compile HTTP/1.1',
              'Host: lab',
              'Content-Type: application/json',
              `X-Lab-Secret: ${SECRET}`,
              'X-Lab-Client-IP: 203.0.113.7',
              `Content-Length: ${body.length}`,
              '',
              body,
            ].join(CRLF),
          );
          socket.destroy();
          setTimeout(done, 20);
        });
      });
    }
    expect(reserved).toBe(0);
    expect(compiled).toBe(0);
    expect((await post(url.href, request)).status).toBe(200);
  });

  it('compiles nothing for a client that leaves while its compile is being reserved', async () => {
    let compiled = 0;
    let reserving = 0;
    let admit: (r: Reservation) => void = () => {};
    const usage: UsageStore = {
      reserve: () => (reserving++, new Promise<Reservation>((go) => (admit = go))),
      settle: async () => {},
    };
    const url = await start({ usage, compile: async () => (compiled++, okResult()) });
    const gone = httpRequest(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Lab-Secret': SECRET, 'X-Lab-Client-IP': '203.0.113.7' },
    });
    gone.on('error', () => {});
    gone.end(JSON.stringify(request));
    await expect.poll(() => reserving).toBe(1);
    gone.destroy();
    await new Promise((r) => setTimeout(r, 50));
    admit({ ok: true });
    await new Promise((r) => setTimeout(r, 50));
    expect(compiled).toBe(0);
  });

  it('refuses a body that is not { source, visitor }, and a source over 200 KB', async () => {
    const url = await start();
    expect((await post(url, 'not json')).status).toBe(400);
    expect((await post(url, { source: 1, visitor: 'v' })).status).toBe(400);
    expect((await post(url, { source: 'x', visitor: 'a b' })).status).toBe(400);
    expect((await post(url, request, { 'X-Lab-Client-IP': '' })).status).toBe(400);
    expect((await post(url, { source: 'x'.repeat(200 * 1024 + 1), visitor: 'v' })).status).toBe(413);
    expect((await labRequest(url, { method: 'GET', headers: { 'X-Lab-Secret': SECRET } })).status).toBe(405);
    expect((await labRequest(url.replace('/compile', '/other'))).status).toBe(404);
  });

  it('runs at most two compiles at once; the rest wait their turn', async () => {
    let running = 0;
    let most = 0;
    const releases: (() => void)[] = [];
    const url = await start({
      compile: async () => {
        running++;
        most = Math.max(most, running);
        await new Promise<void>((go) => releases.push(go));
        running--;
        return okResult();
      },
    });
    const all = Array.from({ length: 5 }, () => post(url, request));
    await expect.poll(() => releases.length).toBe(2);
    await new Promise((r) => setTimeout(r, 50));
    expect(running).toBe(2);
    expect(releases).toHaveLength(2);
    while (releases.length || running) {
      releases.shift()?.();
      await new Promise((r) => setTimeout(r, 10));
    }
    const statuses = (await Promise.all(all)).map((r) => r.status);
    expect(statuses).toEqual([200, 200, 200, 200, 200]);
    expect(most).toBe(2);
  });
});
