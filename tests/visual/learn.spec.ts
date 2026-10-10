/**
 * VISUAL TEST SUITE — VIS-LEARN
 * Screenshot checks for the /learn course map. Not part of `npm test`.
 */
import { test, expect, type Page } from '@playwright/test';

type Theme = 'light' | 'dark';

const HIDE_TIMED_NOTICES = '.update-notice, [data-sonner-toaster] { display: none !important; }';
const SOME_PROGRESS = JSON.stringify({
  version: 1,
  completed: ['pipeline-demo-1', 'pipeline-demo-2', 'transforms-demo-1'],
  current: { lessonId: 'transforms-demo-2', step: 2 },
});

async function open(page: Page, theme: Theme, progress: string | null) {
  await page.addInitScript(
    ({ t, css, p }) => {
      window.localStorage.setItem('vams-theme', t);
      if (p) window.localStorage.setItem('vams-lesson-progress', p);
      const inject = () => {
        const style = document.createElement('style');
        style.textContent = css;
        (document.head ?? document.documentElement).appendChild(style);
      };
      if (document.documentElement) inject();
      else document.addEventListener('DOMContentLoaded', inject, { once: true });
    },
    { t: theme, css: HIDE_TIMED_NOTICES, p: progress },
  );
  await page.goto('/learn');
  await page.waitForSelector('.learn');
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
}

test('VIS-LEARN-01: First visit, light, 1280', async ({ page }) => {
  await open(page, 'light', null);
  await expect(page).toHaveScreenshot('learn-first-light-1280.png', { fullPage: true });
});

test('VIS-LEARN-02: Some progress, dark, 1280', async ({ page }) => {
  await open(page, 'dark', SOME_PROGRESS);
  await expect(page.locator('.learn__status')).toHaveText('3 of 45 lessons done');
  await expect(page).toHaveScreenshot('learn-progress-dark-1280.png', { fullPage: true });
});

test('VIS-LEARN-03: Some progress, light, 390, no horizontal scroll and the Learn link visible', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, 'light', SOME_PROGRESS);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await expect(page.locator('.site-header__link', { hasText: 'Learn' })).toBeVisible();
  await expect(page).toHaveScreenshot('learn-progress-light-390.png', { fullPage: true });
});

test('VIS-LEARN-04: An index link brings its section below the sticky header', async ({ page }) => {
  await open(page, 'light', null);
  await page.click('.learn-index__link[href="#textures"]');
  const top = await page.evaluate(() => document.querySelector('#textures-title')!.getBoundingClientRect().top);
  const headerBottom = await page.evaluate(() => document.querySelector('.site-header')!.getBoundingClientRect().bottom);
  expect(top).toBeGreaterThanOrEqual(headerBottom);
});

test('VIS-LEARN-05: The header page switcher fits a 390 px phone on every site page', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ['/', '/learn', '/about', '/404']) {
    await page.goto(path);
    await page.waitForSelector('.site-header');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
    await expect(page.locator('.site-header__link', { hasText: 'Home' }), path).toBeVisible();
    await expect(page.locator('.site-header__link', { hasText: 'Learn' }), path).toBeVisible();
    await expect(page.locator('.site-header__link', { hasText: 'About' }), path).toBeVisible();
    await expect(page.locator('.site-header__cta'), path).toHaveText('Open app', { useInnerText: true });
    await expect(page.locator('.site-header__cta'), path).toBeVisible();
  }
});
