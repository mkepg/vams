import { defineConfig } from '@playwright/test';

/**
 * Screenshot regression checks for the editor (`npm run test:visual`).
 * Baselines are per machine and live in tests/visual/baseline.local (ignored by *.local).
 * Create them with `npx playwright test --update-snapshots`.
 */
export default defineConfig({
  testDir: 'tests/visual',
  snapshotPathTemplate: '{testDir}/baseline.local/{arg}{ext}',
  outputDir: 'tests/visual/results.local',
  reporter: 'list',
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://localhost:4319',
    channel: 'chrome',
    viewport: { width: 1280, height: 720 },
    reducedMotion: 'reduce',
    colorScheme: 'light',
  },
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled' },
  },
  webServer: {
    command: 'npm run build && npx vite preview --port 4319 --strictPort',
    url: 'http://localhost:4319',
    reuseExistingServer: false,
    timeout: 240_000,
  },
});
