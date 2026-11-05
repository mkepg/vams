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
  await expect(page.locator('.learn__status')).toHaveText('3 of 59 lessons done');
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

test('VIS-LEARN-05: The header page switcher fits every width from 320 to 760 px, with five links and with six, on every site page', async ({ page }) => {
  const widths = Array.from({ length: 45 }, (_, i) => 320 + i * 10);
  const problems: string[] = [];
  for (const path of ['/', '/learn', '/gallery', '/guide', '/about', '/404']) {
    await page.setViewportSize({ width: 760, height: 844 });
    await page.goto(path);
    await page.waitForSelector('.site-header');
    await page.evaluate(() => document.fonts.ready);
    // The visual build has the Lab on, so its header has six links. The five-link header (the Lab
    // off, as production has it) differs only by the Lab item, and its styles key on the count.
    const layouts = (await page.locator('.site-header__link[href="/lab"]').count()) ? [6, 5] : [5];
    for (const links of layouts) {
      if (links === 5) await page.evaluate(() => document.querySelector('.site-header__link[href="/lab"]')?.closest('li')?.remove());
      expect(await page.locator('.site-header__pages > li').count(), `${path} ${links} links`).toBe(links);
      for (const width of widths) {
        await page.setViewportSize({ width, height: 844 });
        const seen = await page.evaluate(() => {
          const root = document.documentElement;
          const header = document.querySelector('.site-header')!;
          const shown = (el: Element | null) => !!el && el.checkVisibility() && el.getClientRects().length > 0;
          const link = (label: string) => [...document.querySelectorAll('.site-header__link')].find((a) => a.textContent?.trim() === label) ?? null;
          const right = Math.max(...[...header.querySelectorAll('.site-header__home, .site-header__pages, .site-header__actions > *')].filter(shown).map((el) => el.getBoundingClientRect().right));
          return {
            page: root.scrollWidth - root.clientWidth,
            header: header.scrollWidth - header.clientWidth,
            // Inside the header's padding, so the gutters either side stay even.
            past: right - (header.getBoundingClientRect().right - parseFloat(getComputedStyle(header).paddingRight)),
            overlap: document.querySelector('.site-header__pages')!.getBoundingClientRect().right - document.querySelector('.site-header__actions')!.getBoundingClientRect().left,
            home: shown(link('Home')),
            pages: ['Learn', 'Gallery', 'Guide', 'About'].filter((l) => !shown(link(l))),
            cta: (document.querySelector('.site-header__cta') as HTMLElement).innerText,
          };
        });
        const label = `${width} ${path} ${links} links`;
        if (seen.page > 0 || seen.header > 0 || seen.past > 0) problems.push(`${label}: runs ${Math.max(seen.page, seen.header, Math.ceil(seen.past))} px past its edge`);
        // The logo links home, so on narrow screens the switcher drops its Home segment.
        if (seen.overlap > 0) problems.push(`${label}: the switcher runs ${Math.ceil(seen.overlap)} px into the buttons`);
        if (seen.home) problems.push(`${label}: Home is shown`);
        if (seen.pages.length) problems.push(`${label}: ${seen.pages.join(', ')} hidden`);
        if (seen.cta !== 'Open app') problems.push(`${label}: the button reads ${seen.cta}`);
      }
    }
  }
  expect(problems).toEqual([]);
});
