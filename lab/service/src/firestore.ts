/**
 * A small Firestore client over the REST API, signed in with the token from
 * Cloud Run's metadata server. It has only what the usage counter needs:
 * transactions, batch reads and commits.
 */

export const METADATA_TOKEN_URL = 'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token';
/** A Firestore or metadata call that takes longer than this fails. */
export const CALL_TIMEOUT_MS = 10_000;
/** A rollback is a courtesy that frees the transaction's locks early, so it waits less. */
export const ROLLBACK_TIMEOUT_MS = 1_000;

export interface Value {
  integerValue?: string;
  doubleValue?: number;
  timestampValue?: string;
  mapValue?: { fields?: Fields };
}
export type Fields = Record<string, Value>;

export interface Write {
  update: { name: string; fields: Fields };
  updateMask?: { fieldPaths: string[] };
  updateTransforms?: { fieldPath: string; increment: Value }[];
}

export class FirestoreError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const int = (n: number): Value => ({ integerValue: String(Math.round(n)) });
export const double = (n: number): Value => ({ doubleValue: n });
export const numberOf = (v: Value | undefined): number =>
  v?.integerValue !== undefined ? Number(v.integerValue) : (v?.doubleValue ?? 0);

/** Joins field names into a field path, quoting any that isn't a plain identifier. */
export const fieldPath = (...names: string[]) =>
  names.map((n) => (/^[A-Za-z_][A-Za-z0-9_]*$/.test(n) ? n : `\`${n.replace(/[`\\]/g, '\\$&')}\``)).join('.');

export interface Firestore {
  /** The full name of a document, from a path such as usage/2026-10. */
  name(path: string): string;
  /** Starts a read-write transaction; `retry` names one that lost to another and is tried again. */
  begin(retry?: string): Promise<string>;
  /** Reads documents by path. A missing document reads as null. */
  get(paths: string[], transaction?: string): Promise<Map<string, Fields | null>>;
  commit(writes: Write[], transaction?: string): Promise<void>;
  rollback(transaction: string): Promise<void>;
}

export function firestore(project: string, fetchFn: typeof fetch = fetch): Firestore {
  const root = `projects/${project}/databases/(default)/documents`;
  const base = `https://firestore.googleapis.com/v1/${root}`;
  const name = (path: string) => `${root}/${path}`;

  let token = '';
  let expires = 0;
  const signIn = async () => {
    if (token && Date.now() < expires) return token;
    const res = await fetchFn(METADATA_TOKEN_URL, {
      headers: { 'Metadata-Flavor': 'Google' },
      signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
    });
    if (!res.ok) throw new FirestoreError(res.status, 'The metadata server gave no token.');
    const body = (await res.json()) as { access_token: string; expires_in: number };
    token = body.access_token;
    // Renew a minute early.
    expires = Date.now() + (body.expires_in - 60) * 1000;
    return token;
  };

  const call = async (method: string, body: unknown, timeout = CALL_TIMEOUT_MS): Promise<unknown> => {
    const res = await fetchFn(`${base}:${method}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await signIn()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeout),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new FirestoreError(res.status, `Firestore ${method} answered ${res.status}: ${text.slice(0, 300)}`);
    }
    return res.json();
  };

  return {
    name,
    async begin(retry) {
      const readWrite = retry ? { retryTransaction: retry } : {};
      const { transaction } = (await call('beginTransaction', { options: { readWrite } })) as { transaction: string };
      return transaction;
    },
    async get(paths, transaction) {
      const found = new Map<string, Fields | null>(paths.map((p) => [p, null]));
      const byName = new Map(paths.map((p) => [name(p), p]));
      const answers = (await call('batchGet', { documents: [...byName.keys()], ...(transaction && { transaction }) })) as {
        found?: { name: string; fields?: Fields };
      }[];
      for (const a of answers) {
        const path = a.found && byName.get(a.found.name);
        if (path) found.set(path, a.found!.fields ?? {});
      }
      return found;
    },
    async commit(writes, transaction) {
      await call('commit', { writes, ...(transaction && { transaction }) });
    },
    async rollback(transaction) {
      await call('rollback', { transaction }, ROLLBACK_TIMEOUT_MS);
    },
  };
}
