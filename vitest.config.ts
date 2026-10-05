import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  resolve: {
    // Prefer ESM entry points, as the browser build does. A CommonJS entry (lucide-react's
    // `main`) would `require('react')` and load real React, bypassing the alias below.
    mainFields: ['module', 'jsnext:main', 'jsnext'],
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      react: 'preact/compat',
      'react-dom': 'preact/compat',
      'react/jsx-runtime': 'preact/jsx-runtime',
    },
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['./tests/setup.ts'],
    // Transform React-ecosystem component libraries through Vite so their `react`
    // imports resolve to preact/compat (needed when prerendering components in tests).
    server: {
      deps: {
        inline: ['lucide-react', 'zustand'],
      },
    },
    reporters: ['default', 'json'],
    outputFile: {
      json: './tests/reports/vitest-results.json',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      reportsDirectory: './tests/reports/coverage',
      include: [
        'src/entities/scene/model/scene-slice.ts',
        'src/entities/scene/model/interaction-slice.ts',
        'src/entities/scene/model/viewport-slice.ts',
        'src/entities/project/model/project-io.ts',
        'src/core/store/lesson-slice.ts',
        'src/core/store/callbacks-slice.ts',
        'src/core/store/history-slice.ts',
        'src/core/store/runtime-slice.ts',
        'src/features/code-generation/model/code-generator.ts',
        'src/features/code-generation/model/generate-from-state.ts',
        'src/features/code-generation/model/generator/utils.ts',
        'src/features/code-generation/model/generator/state.ts',
        'src/features/code-generation/model/generator/render.ts',
        'src/features/code-generation/model/generator/buffers.ts',
        'src/features/code-generation/model/generator/textures.ts',
      ],
      // The following files are runtime-only (DOM hooks, code-diff UI helpers,
      // GLUT annotation tables) and require a real browser to exercise — they
      // are deliberately scoped out of the coverage tally per Section 3.10's
      // Table 13 module list.
      exclude: [
        'src/features/code-generation/model/code-diff.ts',
        'src/features/code-generation/model/glut-annotations.ts',
        'src/features/code-generation/model/useCanvasSize.ts',
      ],
      thresholds: {
        lines: 75,
        branches: 70,
        functions: 75,
        statements: 75,
      },
    },
  },
});
