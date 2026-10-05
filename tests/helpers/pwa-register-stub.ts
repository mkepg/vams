/** Stands in for vite-plugin-pwa's virtual module, which exists only in a real build. */
export function registerSW(): (reloadPage?: boolean) => Promise<void> {
  return async () => {};
}
