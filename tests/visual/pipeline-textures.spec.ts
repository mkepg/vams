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

const RASTER_VECTOR = [
  ['VIS-PT-03', 'dark'],
  ['VIS-PT-04', 'light'],
] as const;

for (const [id, theme] of RASTER_VECTOR) {
  test(`${id}: Raster vs vector, ${theme}, 1280`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openLesson(page, 'pipeline-demo-2', theme);
    const bar = page.locator('.lesson-bar');
    await expect(bar).toContainText('Step 1 of');
    const pane = page.locator('.canvas-pane');
    await expect(pane.locator('.raster-vector-view')).toBeVisible();
    await expect(pane.locator('.rv-pane--raster .rv-copy')).toContainText('The same shape as 24 × 24 pixels.');
    await expect(pane).toHaveScreenshot(`pt-raster-vector-${theme}-1280.png`);
  });
}

const QUIZ = [
  ['VIS-PT-05', 'dark'],
  ['VIS-PT-06', 'light'],
] as const;

for (const [id, theme] of QUIZ) {
  test(`${id}: a Which Stage? picture on the canvas, ${theme}, 1280`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    // The lesson shuffles its questions with Math.random; a fixed-seed generator fixes the order.
    await page.addInitScript(() => {
      let a = 0x2f6e2b1;
      Math.random = () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    });
    await openLesson(page, 'pipeline-exercise-2', theme);
    const bar = page.locator('.lesson-bar');
    const next = page.locator('.lesson-bar__next');
    const prompt = bar.locator('.widget-prompt');
    for (let step = 2; step <= 9; step++) {
      if ((await prompt.count()) > 0 && (await prompt.first().textContent())?.includes('binds continuous shapes to a pixel grid')) break;
      // A question has to be answered before Next opens; try the options until one is right.
      const options = bar.locator('.mc-option');
      for (let i = 0; i < (await options.count()) && (await next.isDisabled()); i++) await options.nth(i).click();
      await expect(next).toBeEnabled();
      await next.click();
      await expect(bar).toContainText(`Step ${step} of`);
    }
    await expect(prompt).toContainText('Which stage binds continuous shapes to a pixel grid?');
    await expect(page.locator('.canvas-pane .quiz-figure svg.stage-figure')).toBeVisible();
    await expect(page).toHaveScreenshot(`pt-quiz-raster-${theme}-1280.png`);
  });
}

test('VIS-PT-07: Quick Gradients as previews of the selected triangle, light, 1280', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    window.localStorage.setItem('vams-theme', 'light');
    window.localStorage.setItem('vams-storage', JSON.stringify({ state: { hasSeenWelcome: true }, version: 11 }));
    const css = '.update-notice, [data-sonner-toaster] { display: none !important; } .scene-title__state { visibility: hidden !important; }';
    const inject = () => {
      const style = document.createElement('style');
      style.textContent = css;
      (document.head ?? document.documentElement).appendChild(style);
    };
    if (document.documentElement) inject();
    else document.addEventListener('DOMContentLoaded', inject, { once: true });
  });
  await page.goto('/app?scene=triangle');
  await page.waitForSelector('.editor');
  await page.getByRole('treeitem', { name: 'Triangle' }).click();
  const group = page.locator('[data-group="appearance"]');
  const header = group.locator('.inspector-group__header');
  if ((await header.getAttribute('aria-expanded')) !== 'true') await header.click();
  await group.getByRole('radio', { name: 'Per vertex' }).click();
  await expect(group.locator('button.gradient-preview')).toHaveCount(5);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
  const presets = group.locator('.gradient-presets');
  await presets.scrollIntoViewIfNeeded();
  await expect(presets).toHaveScreenshot('pt-quick-gradients-light-1280.png');
});
