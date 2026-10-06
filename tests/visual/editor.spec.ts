/**
 * VISUAL TEST SUITE — VIS-EDITOR
 * Screenshot regression checks for the editor layout. Not part of `npm test`.
 */
import { test, expect, type Page } from '@playwright/test';

type Theme = 'vellum' | 'blueprint';

async function open(page: Page, path: string, theme: Theme = 'vellum') {
  await page.addInitScript((t) => {
    window.localStorage.setItem('vams-theme', t);
  }, theme);
  await page.goto(path);
  await page.waitForSelector('.editor');
  // The offline notice appears on a timer once the service worker installs; keep it out of screenshots.
  await page.addStyleTag({ content: '.update-notice { display: none !important; }' });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
}

test('VIS-EDITOR-01: Transforms scene, vellum, 1280', async ({ page }) => {
  await open(page, '/app?scene=transforms');
  await expect(page).toHaveScreenshot('transforms-vellum-1280.png');
});

test('VIS-EDITOR-02: Transforms scene, blueprint, 1280', async ({ page }) => {
  await open(page, '/app?scene=transforms', 'blueprint');
  await expect(page).toHaveScreenshot('transforms-blueprint-1280.png');
});

test('VIS-EDITOR-03: Primitives tour, 1280', async ({ page }) => {
  await open(page, '/app?scene=primitives');
  await expect(page).toHaveScreenshot('primitives-1280.png');
});

test('VIS-EDITOR-04: Textured quad, 1280', async ({ page }) => {
  await open(page, '/app?scene=textured-quad');
  await expect(page).toHaveScreenshot('textured-quad-1280.png');
});

test('VIS-EDITOR-05: Lesson column, vellum and blueprint', async ({ page }) => {
  await open(page, '/app?lesson=transforms-exercise-1');
  await expect(page).toHaveScreenshot('lesson-vellum-1280.png');
  await open(page, '/app?lesson=transforms-exercise-1', 'blueprint');
  await expect(page).toHaveScreenshot('lesson-blueprint-1280.png');
});

test('VIS-EDITOR-06: Lesson quiz step', async ({ page }) => {
  // Quiz questions and answer order are drawn at random; fix the generator so the card is the same on every run.
  await page.addInitScript(() => {
    let seed = 1;
    Math.random = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
  });
  await open(page, '/app?lesson=pipeline-exercise-2');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page).toHaveScreenshot('lesson-quiz-1280.png');
});

test('VIS-EDITOR-07: Narrow layout, drawer closed and open', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await open(page, '/app?scene=transforms');
  await expect(page).toHaveScreenshot('narrow-closed-960.png');
  await page.getByRole('button', { name: 'Panels' }).click();
  await expect(page).toHaveScreenshot('narrow-open-960.png');
});

test('VIS-EDITOR-08: Menus and the My scenes dialog', async ({ page }) => {
  await open(page, '/app?scene=transforms');
  await page.getByRole('button', { name: 'File' }).click();
  await expect(page).toHaveScreenshot('file-menu.png');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Transforms' }).click();
  await expect(page).toHaveScreenshot('section-menu.png');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'File' }).click();
  await page.getByRole('menuitem', { name: 'My scenes…' }).click();
  // The name field starts with a timestamp; fix it so the capture does not change by the minute.
  await page.getByRole('dialog').getByRole('textbox').fill('Scene name');
  await expect(page).toHaveScreenshot('my-scenes.png');
});
