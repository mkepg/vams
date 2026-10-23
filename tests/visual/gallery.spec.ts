/**
 * VISUAL TEST SUITE — VIS-GALLERY
 * Screenshot checks for the Gallery page. Not part of `npm test`.
 */
import { test, expect, type Page } from '@playwright/test';

type Theme = 'light' | 'dark';

const HIDE_TIMED_NOTICES = '.update-notice, [data-sonner-toaster] { display: none !important; }';

async function open(page: Page, theme: Theme) {
  await page.addInitScript(
    ({ t, css }) => {
      window.localStorage.setItem('vams-theme', t);
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
  await page.goto('/gallery');
  await page.waitForSelector('.gallery');
  // Lazy images below the fold load before a full-page screenshot.
  await page.evaluate(async () => {
    await document.fonts.ready;
    for (const img of document.images) {
      img.loading = 'eager';
      await img.decode().catch(() => undefined);
    }
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
}

test('VIS-GALLERY-01: Light, 1280', async ({ page }) => {
  await open(page, 'light');
  await expect(page).toHaveScreenshot('gallery-light-1280.png', { fullPage: true });
});

test('VIS-GALLERY-02: Dark, 1280', async ({ page }) => {
  await open(page, 'dark');
  await expect(page).toHaveScreenshot('gallery-dark-1280.png', { fullPage: true });
});

test('VIS-GALLERY-03: Light, 390, no horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, 'light');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await expect(page).toHaveScreenshot('gallery-light-390.png', { fullPage: true });
});

test('VIS-GALLERY-04: A card opens its scene in the editor', async ({ page }) => {
  await open(page, 'light');
  // The card's link covers it, so a click on the image lands on the link.
  const image = page.locator('.gallery-card', { hasText: 'Solar system' }).locator('img');
  await image.scrollIntoViewIfNeeded();
  const box = (await image.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForSelector('.editor');
  await expect(page.locator('.scene-title')).toContainText('Solar system');
});
