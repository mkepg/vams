import type { VitePWAOptions } from 'vite-plugin-pwa';

/** Navy ink and vellum paper from src/shared/styles/_tokens.scss. */
export const PWA_THEME_COLOR = '#1d2b4f';
export const PWA_BACKGROUND_COLOR = '#f4f5f2';

interface PrecacheEntry {
  url: string;
  revision: string | null;
  size: number;
}

/**
 * The clean URL a prerendered route document is requested by (app/index.html → app), or null.
 * The root document is served through Workbox's directory index, and the 404 page is the
 * offline fallback, so neither needs another entry.
 */
export function toRouteUrl(url: string): string | null {
  const match = /^(.+)\/index\.html$/.exec(url);
  return match && match[1] !== '404' ? match[1] : null;
}

/** Cache each route document under its clean URL as well, so /app and /app/ both open offline. */
export async function routeDocumentsTransform(entries: PrecacheEntry[]) {
  const manifest = entries.flatMap((entry) => {
    const clean = toRouteUrl(entry.url);
    return clean ? [entry, { ...entry, url: clean }] : [entry];
  });
  return { manifest, warnings: [] as string[] };
}

export function buildPwaOptions(): Partial<VitePWAOptions> {
  return {
    // A new version waits until the user chooses Reload; nothing swaps code mid-session.
    registerType: 'prompt',
    injectRegister: false,
    manifest: {
      name: 'VAMS — Visual OpenGL 1.5 simulator',
      short_name: 'VAMS',
      description: 'See the OpenGL behind every shape.',
      start_url: '/app',
      scope: '/',
      display: 'standalone',
      background_color: PWA_BACKGROUND_COLOR,
      theme_color: PWA_THEME_COLOR,
      icons: [
        { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        { src: '/maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: {
      // The plugin adds manifest.webmanifest itself.
      globPatterns: ['**/*.{html,js,css,woff,woff2,ttf,svg,png,ico}'],
      globIgnores: ['og/**'],
      // /app?scene=triangle and /?stage resolve to their cached pages.
      ignoreURLParametersMatching: [/.*/],
      manifestTransforms: [routeDocumentsTransform],
      navigateFallback: '/404/index.html',
      navigateFallbackDenylist: [/^\/sitemap\.xml$/, /^\/robots\.txt$/],
      cleanupOutdatedCaches: true,
      maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
    },
    devOptions: { enabled: false },
  };
}
