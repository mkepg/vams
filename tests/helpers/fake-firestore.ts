/**
 * A fake of the Firestore REST API and Cloud Run's metadata token, as a `fetch`.
 * It keeps documents in memory, applies commits (whole-document updates and
 * increments), and records every call so tests can count writes.
 */

type Value = {
  integerValue?: string;
  doubleValue?: number;
  stringValue?: string;
  timestampValue?: string;
  mapValue?: { fields?: Fields };
};
type Fields = Record<string, Value>;

interface Write {
  update: { name: string; fields: Fields };
  updateMask?: { fieldPaths: string[] };
  updateTransforms?: { fieldPath: string; increment: Value }[];
}

export interface FakeCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

const TOKEN_URL = 'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token';

/** Splits a field path such as days.`07` into its segments. */
function segments(path: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < path.length) {
    if (path[i] === '`') {
      const end = path.indexOf('`', i + 1);
      out.push(path.slice(i + 1, end));
      i = end + 2;
    } else {
      const end = path.indexOf('.', i);
      out.push(path.slice(i, end < 0 ? path.length : end));
      i = end < 0 ? path.length : end + 1;
    }
  }
  return out;
}

const numberOf = (v: Value | undefined) => (v?.integerValue !== undefined ? Number(v.integerValue) : (v?.doubleValue ?? 0));

function increment(fields: Fields, path: string[], by: Value): void {
  const [head, ...rest] = path;
  if (rest.length) {
    const inner = (fields[head] ??= { mapValue: { fields: {} } });
    inner.mapValue ??= { fields: {} };
    increment((inner.mapValue.fields ??= {}), rest, by);
    return;
  }
  const sum = numberOf(fields[head]) + numberOf(by);
  const isInt = by.integerValue !== undefined && (fields[head]?.integerValue !== undefined || fields[head] === undefined);
  fields[head] = isInt ? { integerValue: String(sum) } : { doubleValue: sum };
}

export function fakeFirestore(project = 'vams-test') {
  const root = `projects/${project}/databases/(default)/documents`;
  const base = `https://firestore.googleapis.com/v1/${root}`;
  const docs = new Map<string, Fields>();
  const calls: FakeCall[] = [];
  let transactions = 0;

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  const fetch = async (input: string | URL | Request, init: RequestInit = {}): Promise<Response> => {
    const url = String(input);
    const headers = Object.fromEntries(
      Object.entries((init.headers ?? {}) as Record<string, string>).map(([k, v]) => [k.toLowerCase(), v]),
    );
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
    calls.push({ url, method: init.method ?? 'GET', headers, body });

    if (url === TOKEN_URL) {
      if (headers['metadata-flavor'] !== 'Google') return json({ error: 'flavor' }, 403);
      return json({ access_token: 'fake-token', expires_in: 3599, token_type: 'Bearer' });
    }
    if (headers.authorization !== 'Bearer fake-token') return json({ error: 'auth' }, 401);
    if (url === `${base}:beginTransaction`) return json({ transaction: `tx-${++transactions}` });
    if (url === `${base}:rollback`) return json({});
    if (url === `${base}:batchGet`) {
      const { documents } = body as { documents: string[] };
      return json(
        documents.map((name) => {
          const fields = docs.get(name);
          return fields ? { found: { name, fields: structuredClone(fields) } } : { missing: name };
        }),
      );
    }
    if (url === `${base}:commit`) {
      for (const w of (body as { writes: Write[] }).writes) {
        const { name, fields } = w.update;
        let doc = docs.get(name) ?? {};
        if (w.updateMask) {
          for (const p of w.updateMask.fieldPaths) doc[p] = fields[p];
        } else {
          doc = structuredClone(fields);
        }
        for (const t of w.updateTransforms ?? []) increment(doc, segments(t.fieldPath), t.increment);
        docs.set(name, doc);
      }
      return json({ commitTime: new Date().toISOString() });
    }
    return json({ error: `unexpected ${url}` }, 404);
  };

  const commits = () => calls.filter((c) => c.url === `${base}:commit`);
  return {
    fetch: fetch as typeof globalThis.fetch,
    calls,
    docs,
    /** The full name of a document, from a path such as usage/2026-10. */
    name: (path: string) => `${root}/${path}`,
    /** Document writes sent so far, each write in a commit counted once. */
    writes: () => commits().reduce((n, c) => n + (c.body as { writes: unknown[] }).writes.length, 0),
    commits,
  };
}
