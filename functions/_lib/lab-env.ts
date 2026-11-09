/** Environment for the Lab's Pages Function. */
export interface LabEnv {
  /** The shared runtime (main module, compiler and headers), stored under `<version>/<file>`. */
  LAB_RUNTIME: {
    getWithMetadata<M>(key: string, type: 'stream'): Promise<{ value: ReadableStream | null; metadata: M | null }>;
  };
}
