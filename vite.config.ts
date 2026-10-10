import { defineConfig, loadEnv, type Plugin } from 'vite'
import preact from '@preact/preset-vite'
import { fileURLToPath, URL } from 'node:url'
import { DEFAULT_SITE_URL } from './src/app/routes/route-meta'
import { VitePWA } from 'vite-plugin-pwa'
import { buildPwaOptions } from './src/app/pwa/pwa-options'
import { buildRobots, buildSitemap } from './src/app/seo/sitemap'

function seoFiles(siteUrl: string): Plugin {
  return {
    name: 'vams-seo-files',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: buildSitemap(siteUrl) })
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: buildRobots(siteUrl) })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const siteUrl = env.VITE_SITE_URL?.trim() || DEFAULT_SITE_URL

  return {
    plugins: [
      preact({
        prerender: {
          enabled: true,
          renderTarget: '#root',
          additionalPrerenderRoutes: ['/404', '/learn'],
          previewMiddlewareEnabled: true,
          previewMiddlewareFallback: '/404',
        },
      }),
      seoFiles(siteUrl),
      VitePWA(buildPwaOptions()),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        react: 'preact/compat',
        'react-dom': 'preact/compat',
        'react/jsx-runtime': 'preact/jsx-runtime',
      },
    },
  }
})
