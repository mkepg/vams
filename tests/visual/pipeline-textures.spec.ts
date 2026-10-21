/**
 * VISUAL TEST SUITE — VIS-PT
 * Screenshot checks for the Pipeline illustrations and the texture controls. Not part of `npm test`.
 */
import { test, expect } from '@playwright/test';
import { openLesson } from './helpers/open-lesson';

const THEMES = [
  ['VIS-PT-01', 'dark'],
  ['VIS-PT-02', 'light'],
] as const;

test.use({ viewport: { width: 1280, height: 800 } });

for (const [id, theme] of THEMES) {
  test(`${id}: the Diagram at Rasterisation, ${theme}, 1280`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openLesson(page, 'pipeline-demo-1', theme);
    const bar = page.locator('.lesson-bar');
    const next = page.locator('.lesson-bar__next');
    for (let step = 2; step <= 6; step++) {
      await expect(next).toBeEnabled();
      await next.click();
      await expect(bar).toContainText(`Step ${step} of 9`);
    }
    const pane = page.locator('.canvas-pane');
    await expect(pane.locator('.pipeline-strip__stage[aria-pressed="true"]')).toContainText('Raster');
    await expect(pane.locator('.pipeline-focus')).toContainText('Rasterisation');
    await expect(pane).toHaveScreenshot(`pt-diagram-raster-${theme}-1280.png`);
  });
}
