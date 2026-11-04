import { defineConfig, loadEnv, type Plugin } from 'vite'
import preact from '@preact/preset-vite'
import { fileURLToPath, URL } from 'node:url'
import { DEFAULT_SITE_URL, prerenderRoutes, publishedRoutes } from './src/app/routes/route-meta'
import { VitePWA } from 'vite-plugin-pwa'
import { buildPwaOptions } from './src/app/pwa/pwa-options'
import { buildRobots, buildSitemap } from './src/app/seo/sitemap'
import { LAB_LIVE } from './src/pages/lab/model/lab-live'
import { labEnabled } from './src/pages/lab/model/lab-enabled'
import { LAB_WORKER_OUTPUT, isLabWorkerFile, labDevServer } from './scripts/lab/vite-lab-dev'

function seoFiles(siteUrl: string, labOn: boolean): Plugin {
  return {
    name: 'vams-seo-files',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: buildSitemap(siteUrl, publishedRoutes(labOn)) })
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: buildRobots(siteUrl) })
    },
  }
}

/**
 * With the Lab off nothing loads its program worker, so the build leaves that one file out, and
 * dist/lab is not made at all. Only the Lab worker is matched: any other worker is kept.
 */
function labOffDropsWorker(labOn: boolean): Plugin {
  return {
    name: 'vams-lab-off-drops-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      if (labOn) return
      for (const name of Object.keys(bundle)) if (isLabWorkerFile(name)) delete bundle[name]
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

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const labOn = labEnabled({ live: LAB_LIVE, flag: env.VITE_LAB, dev: command === 'serve' })
  const siteUrl = env.VITE_SITE_URL?.trim() || DEFAULT_SITE_URL

  return {
    define: { __LAB_ENABLED__: JSON.stringify(labOn) },
    // Workers are ES modules (the Lab's imports its runtime at run time). LAB_WORKER_OUTPUT serves
    // the Lab's from /lab/, for its isolation headers, and leaves any other worker in /assets/.
    worker: { format: 'es', rollupOptions: { output: LAB_WORKER_OUTPUT } },
    plugins: [
      preact({
        prerender: {
          enabled: true,
          renderTarget: '#root',
          additionalPrerenderRoutes: prerenderRoutes(labOn),
          previewMiddlewareEnabled: true,
          previewMiddlewareFallback: '/404',
        },
      }),
      labDevServer(fileURLToPath(new URL('./lab/runtime/out', import.meta.url))),
      seoFiles(siteUrl, labOn),
      labOffDropsWorker(labOn),
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
