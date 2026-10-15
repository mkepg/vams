/**
 * VISUAL TEST SUITE — VIS-CM
 * The code panel and the math journey in the approved mocks' scene. Not part of `npm test`.
 */
import { test, expect, type Page } from '@playwright/test';

type Theme = 'light' | 'dark';

const HIDE_TIMED_NOTICES = '.update-notice, [data-sonner-toaster] { display: none !important; }';

const vertex = (id: string, x: number, y: number, color: string) => ({ id, x, y, color });
const shape = (id: string, name: string, type: string, vertices: unknown[], transform: Record<string, number>) => ({
  id, name, type, visible: true, shading: 'SMOOTH', vertices,
  transform: { translateX: 0, translateY: 0, rotate: 0, scaleX: 1, scaleY: 1, ...transform },
  parentId: null, children: [], colorMode: 'FLOAT', lineStipple: null, renderingMode: 'IMMEDIATE',
  bufferUsage: 'STATIC', useIndexed: false, updateMethod: 'BUFFER_SUB_DATA', texture: null, uvs: null,
});

/** The mocks' scene: Triangle moved 0.30, −0.17 and turned 15°, then Square and Dot. Each test sets X to 0.40. */
const MOCK_OBJECTS = [
  shape('triangle', 'Triangle', 'TRIANGLES',
    [vertex('tri-v0', 0, 0.5, '#ff6633'), vertex('tri-v1', -0.5, -0.5, '#3399ff'), vertex('tri-v2', 0.5, -0.5, '#55dd88')],
    { translateX: 0.3, translateY: -0.17, rotate: 15 }),
  shape('square', 'Square', 'QUADS',
    [vertex('sq-v0', -0.2, -0.2, '#5b8def'), vertex('sq-v1', 0.2, -0.2, '#5b8def'), vertex('sq-v2', 0.2, 0.2, '#5b8def'), vertex('sq-v3', -0.2, 0.2, '#5b8def')],
    { translateX: -0.55, translateY: 0.45 }),
  shape('dot', 'Dot', 'POINTS', [vertex('dot-v0', 0, 0, '#ffffff')], { translateX: 0.6, translateY: 0.6 }),
];

/**
 * Opens the editor on the mocks' scene with Triangle selected and its Translate X just changed to 0.40.
 * Reduced motion makes the changed value's wash hold still for its 2 s instead of fading, so a
 * stable screenshot still shows the mark.
 */
export async function openMockScene(page: Page, theme: Theme) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(
    ({ t, css, objects }) => {
      window.localStorage.setItem('vams-theme', t);
      window.localStorage.setItem('vams-storage', JSON.stringify({
        state: { objects, hasSeenWelcome: true, activeSection: 'Transforms' },
        version: 9,
      }));
      const inject = () => {
        const style = document.createElement('style');
        style.textContent = css;
        (document.head ?? document.documentElement).appendChild(style);
      };
      if (document.documentElement) inject();
      else document.addEventListener('DOMContentLoaded', inject, { once: true });
    },
    { t: theme, css: HIDE_TIMED_NOTICES, objects: MOCK_OBJECTS },
  );
  await page.goto('/app');
  await page.waitForSelector('.editor');
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await page.getByRole('treeitem', { name: 'Triangle' }).click();
  const x = page.getByLabel('Translate X').first();
  await x.fill('0.40');
  await x.press('Enter');
}

for (const theme of ['dark', 'light'] as const) {
  test(`VIS-CM-01: Code pane, Triangle selected and X just changed, ${theme}, 1280`, async ({ page }) => {
    await openMockScene(page, theme);
    // Reduced motion holds the wash still for 2 s, so the stable screenshot is taken while the mark shows.
    await expect(page.locator('.code-math-column')).toHaveScreenshot(`cm-code-${theme}-1280.png`, { animations: 'allow' });
    await expect(page).toHaveScreenshot(`cm-editor-code-${theme}-1280.png`, { animations: 'allow' });
  });
}

for (const theme of ['dark', 'light'] as const) {
  test(`VIS-CM-02: Math pane, Transformed open, following vertex 1, ${theme}, 1280`, async ({ page }) => {
    await openMockScene(page, theme);
    await page.getByRole('radio', { name: 'Math' }).click();
    await expect(page.locator('.journey-open__title')).toHaveText('Transformed');
    await expect(page.locator('.code-math-column')).toHaveScreenshot(`cm-journey-transformed-${theme}-1280.png`);
    await expect(page).toHaveScreenshot(`cm-editor-math-${theme}-1280.png`);
  });
}

for (const stage of ['Projected', 'Coloured'] as const) {
  test(`VIS-CM-03: Math pane, ${stage} open, dark, 1280`, async ({ page }) => {
    await openMockScene(page, 'dark');
    await page.getByRole('radio', { name: 'Math' }).click();
    await page.locator('.journey-stage__row', { hasText: stage }).click();
    await expect(page.locator('.journey-open__title')).toHaveText(stage);
    await expect(page.locator('.code-math-column')).toHaveScreenshot(`cm-journey-${stage.toLowerCase()}-dark-1280.png`);
  });
}

const STAGES = ['Stored', 'Transformed', 'Projected', 'Assembled', 'Rasterised', 'Coloured'] as const;

for (const theme of ['dark', 'light'] as const) {
  test(`VIS-CM-06: Math pane, every stage open in turn, ${theme}, 1280`, async ({ page }) => {
    await openMockScene(page, theme);
    await page.getByRole('radio', { name: 'Math' }).click();
    for (const stage of STAGES) {
      // The open stage has no closed row to click; the scene opens on Transformed.
      const row = page.locator('.journey-stage__row', { hasText: stage });
      if ((await row.count()) > 0) await row.click();
      await expect(page.locator('.journey-open__title')).toHaveText(stage);
      await expect(page.locator('.code-math-column')).toHaveScreenshot(`cm-stage-${stage.toLowerCase()}-${theme}-1280.png`);
    }
  });
}
