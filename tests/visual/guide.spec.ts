/**
 * VISUAL TEST SUITE — VIS-GUIDE
 * Screenshot checks for the /guide and /teach pages and the header's search. Not part of `npm test`.
 */
import { test, expect, type Page } from '@playwright/test';

type Theme = 'light' | 'dark';

const HIDE_TIMED_NOTICES = '.update-notice, [data-sonner-toaster] { display: none !important; }';

async function open(page: Page, path: string, theme: Theme) {
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
  await page.goto(path);
  await page.waitForSelector('main');
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
}

for (const theme of ['light', 'dark'] as const) {
  test(`VIS-GUIDE-01: the guide's first screen, ${theme}, 1280`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await open(page, '/guide', theme);
    await expect(page).toHaveScreenshot(`guide-${theme}-1280.png`);
  });
}

test('VIS-GUIDE-02: the glossary, reached from its link, light, 1280', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(page, '/guide', 'light');
  await page.locator('.guide-contents a[href="#glossary"]').click();
  await expect(page.locator('#glossary')).toBeInViewport();
  // The sticky header must not cover the topic's title.
  const header = (await page.locator('.site-header').boundingBox())!;
  const title = (await page.locator('#glossary-title').boundingBox())!;
  expect(title.y).toBeGreaterThanOrEqual(header.y + header.height);
  await expect(page).toHaveScreenshot('guide-glossary-light-1280.png');
});

test('VIS-GUIDE-03: the teaching page, light, 1280', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(page, '/teach', 'light');
  await expect(page).toHaveScreenshot('teach-light-1280.png');
});

test('VIS-GUIDE-04: search open with results, dark, 1280', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page, '/learn', 'dark');
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('combobox')).toBeFocused();
  await page.keyboard.type('textu');
  await expect(page.getByRole('option').first()).toHaveAttribute('aria-selected', 'true');
  await expect(page).toHaveScreenshot('search-dark-1280.png');
});

for (const width of [360, 390, 760]) {
  test(`VIS-GUIDE-05: no page scrolls sideways and the header holds every page link, ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    for (const path of ['/', '/learn', '/gallery', '/guide', '/teach', '/about']) {
      await open(page, path, 'light');
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), path).toBeLessThanOrEqual(0);
      const cta = (await page.locator('.site-header__cta').boundingBox())!;
      expect(cta.x + cta.width, path).toBeLessThanOrEqual(width);
      await expect(page.locator('.site-header__link[href="/guide"]'), path).toBeVisible();
    }
  });
}
