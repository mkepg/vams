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

/** Cloudflare Pages returns /404.html with a 404 status; without it, every unknown path gets the home page. */
function notFoundPage(): Plugin {
  return {
    name: 'vams-not-found-page',
    apply: 'build',
    enforce: 'post',
    generateBundle: {
      // The prerender writes 404/index.html during this hook, so copy it afterwards.
      order: 'post',
      handler(_options, bundle) {
        // The prerender joins paths with the OS separator, so match either one.
        const page = Object.values(bundle).find((file) => file.fileName.replace(/\\/g, '/') === '404/index.html')
        if (page?.type !== 'asset') return
        this.emitFile({ type: 'asset', fileName: '404.html', source: page.source })
      },
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
          additionalPrerenderRoutes: ['/404', '/learn', '/about'],
          previewMiddlewareEnabled: true,
          previewMiddlewareFallback: '/404',
        },
      }),
      seoFiles(siteUrl),
      notFoundPage(),
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
