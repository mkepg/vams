export interface ServiceWorkerEvents {
  onNeedRefresh(): void;
  onOfflineReady(): void;
}

export type ApplyUpdate = (reloadPage?: boolean) => Promise<void>;

/**
 * Register the service worker after hydration. Resolves to a function that activates a waiting
 * update and reloads, or to null where service workers are unavailable.
 */
export async function registerServiceWorker(events: ServiceWorkerEvents): Promise<ApplyUpdate | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
  const { registerSW } = await import('virtual:pwa-register');
  return registerSW({ immediate: true, onNeedRefresh: events.onNeedRefresh, onOfflineReady: events.onOfflineReady });
}
