/** Environment for the Lab's two Pages Functions. */
export interface LabEnv {
  /** Base URL of the compile service. Empty until the service is deployed. */
  LAB_COMPILE_URL?: string;
  /** Shared secret the compile service expects in X-Lab-Secret. Set with `wrangler pages secret put`. */
  LAB_COMPILE_SECRET?: string;
  /** The shared runtime (main module, compiler and headers), stored under `<version>/<file>`. */
  LAB_RUNTIME: {
    getWithMetadata<M>(key: string, type: 'stream'): Promise<{ value: ReadableStream | null; metadata: M | null }>;
  };
}

/** The largest request body a compile accepts. */
export const MAX_COMPILE_BODY_BYTES = 200_000;
