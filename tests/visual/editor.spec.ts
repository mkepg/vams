/**
 * VISUAL TEST SUITE — VIS-EDITOR
 * Screenshot regression checks for the editor layout. Not part of `npm test`.
 */
import { test, expect, type Page } from '@playwright/test';

type Theme = 'light' | 'dark';

// Timed notices stay out of screenshots: the offline notice appears once the service worker
// installs, and toasts appear on their own schedule.
const HIDE_TIMED_NOTICES = '.update-notice, [data-sonner-toaster] { display: none !important; }';

async function open(page: Page, path: string, theme: Theme = 'light') {
  await page.addInitScript(
    ({ t, css }) => {
      window.localStorage.setItem('vams-theme', t);
      // Injected before any app script runs, so a notice never paints even for one frame.
      const inject = () => {
        const style = document.createElement('style');
        style.textContent = css;
        (document.head ?? document.documentElement).appendChild(style);
      };
      if (document.documentElement) inject();
      else document.addEventListener('DOMContentLoaded', inject, { once: true });
    },
    { t: theme, css: HIDE_TIMED_NOTICES },
  );
  await page.goto(path);
  await page.waitForSelector('.editor');
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
}

test('VIS-EDITOR-01: Transforms scene, light, 1280', async ({ page }) => {
  await open(page, '/app?scene=transforms');
  await expect(page).toHaveScreenshot('transforms-light-1280.png');
});

test('VIS-EDITOR-02: Transforms scene, dark, 1280', async ({ page }) => {
  await open(page, '/app?scene=transforms', 'dark');
  await expect(page).toHaveScreenshot('transforms-dark-1280.png');
});

test('VIS-EDITOR-03: Primitives tour, 1280', async ({ page }) => {
  await open(page, '/app?scene=primitives');
  await expect(page).toHaveScreenshot('primitives-1280.png');
});

test('VIS-EDITOR-04: Textured quad, 1280', async ({ page }) => {
  await open(page, '/app?scene=textured-quad');
  await expect(page).toHaveScreenshot('textured-quad-1280.png');
});

test('VIS-EDITOR-05: Lesson column, light and dark', async ({ page }) => {
  await open(page, '/app?lesson=transforms-exercise-1');
  await expect(page).toHaveScreenshot('lesson-light-1280.png');
  await open(page, '/app?lesson=transforms-exercise-1', 'dark');
  await expect(page).toHaveScreenshot('lesson-dark-1280.png');
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
