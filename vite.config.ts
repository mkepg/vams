import { defineConfig, loadEnv, type Plugin } from 'vite'
import preact from '@preact/preset-vite'
import { fileURLToPath, URL } from 'node:url'
import { DEFAULT_SITE_URL, prerenderRoutes, publishedRoutes } from './src/app/routes/route-meta'
import { chunkCss, LAZY_ROUTE_PAGES, linkStylesheets, type CssChunk } from './src/app/routes/prerender-css'
import { VitePWA } from 'vite-plugin-pwa'
import { buildPwaOptions } from './src/app/pwa/pwa-options'
import { buildRobots, buildSitemap } from './src/app/seo/sitemap'
import { LAB_LIVE } from './src/pages/lab/model/lab-live'
import { assertLiveRuntime, labEnabled } from './src/pages/lab/model/lab-enabled'
import { runtimeVersion } from './src/features/lab-run/model/runtime-version'
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

/**
 * A lazily loaded route's prerendered page links the CSS of the chunk it loads, so its markup
 * paints styled instead of waiting for the chunk (src/app/routes/prerender-css.ts).
 */
function prerenderedRouteCss(): Plugin {
  return {
    name: 'vams-prerendered-route-css',
    apply: 'build',
    enforce: 'post',
    generateBundle: {
      // The prerender writes the pages during this hook, so link them afterwards.
      order: 'post',
      handler(_options, bundle) {
        const chunks = new Map<string, CssChunk>()
        for (const file of Object.values(bundle)) {
          if (file.type !== 'chunk') continue
          chunks.set(file.fileName, {
            fileName: file.fileName,
            facadeModuleId: file.facadeModuleId,
            imports: file.imports,
            importedCss: file.viteMetadata?.importedCss ?? [],
          })
        }
        for (const [page, module] of Object.entries(LAZY_ROUTE_PAGES)) {
          const html = Object.values(bundle).find((file) => file.fileName.replace(/\\/g, '/') === page)
          const entry = [...chunks.values()].find((chunk) => chunk.facadeModuleId && module.test(chunk.facadeModuleId))
          if (html?.type !== 'asset' || !entry) continue
          html.source = linkStylesheets(String(html.source), chunkCss(entry, chunks))
        }
      },
    },
  }
}

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // A live build must load a published runtime: only the dev server answers /lab-runtime/dev/.
  assertLiveRuntime({ live: LAB_LIVE, build: command === 'build', runtimeVersion })
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
      prerenderedRouteCss(),
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
