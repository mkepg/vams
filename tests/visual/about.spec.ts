/**
 * VISUAL TEST SUITE — VIS-ABOUT
 * Screenshot checks for the About page. Not part of `npm test`.
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
  await page.goto('/about');
  await page.waitForSelector('.about');
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
}

test('VIS-ABOUT-01: Light, 1280', async ({ page }) => {
  await open(page, 'light');
  await expect(page).toHaveScreenshot('about-light-1280.png', { fullPage: true });
});

test('VIS-ABOUT-02: Dark, 1280', async ({ page }) => {
  await open(page, 'dark');
  await expect(page).toHaveScreenshot('about-dark-1280.png', { fullPage: true });
});

test('VIS-ABOUT-03: Light, 390, no horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, 'light');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await expect(page).toHaveScreenshot('about-light-390.png', { fullPage: true });
});
