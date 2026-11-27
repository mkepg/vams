/**
 * VISUAL TEST SUITE — VIS-LAB (the Lab's look)
 * Screenshot checks for /lab with the template program running, at 1280 and 390 px, in both
 * themes. The template compiles with the real compiler in the page, against the local runtime build:
 * LAB_RUNTIME_LOCAL=1 npm run test:visual -- lab.spec lab-drawing lab-compiler. Without it they skip.
 * VIS-LAB-18 needs no runtime: /lab paints styled from its first frame, its wordmark never larger
 * than in the top bar.
 * Not part of `npm test`.
 */
import { expect, test, type Page } from '@playwright/test';
import { LAB_RUNTIME_LOCAL, openLab, requireRuntime, routeLab, runProgram, type Theme } from './helpers/lab';

test.describe('VIS-LAB: the Lab with the template running', () => {
  test.skip(!LAB_RUNTIME_LOCAL, 'Needs the local runtime build: LAB_RUNTIME_LOCAL=1');
  // Each check downloads the compiler into a fresh browser, then compiles.
  test.describe.configure({ timeout: 120_000 });
  test.use({ serviceWorkers: 'block' });

  test.beforeAll(() => requireRuntime());

  async function running(page: Page, theme: Theme) {
    await routeLab(page.context());
    await openLab(page, theme);
    await runProgram(page);
    await expect(page.locator('.lab-top-bar__status')).toContainText('Running');
    await expect(page.locator('.lab-stage__canvas')).toBeVisible();
    // The Console comes forward as the program starts; let the layout settle.
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  }

  const noHorizontalScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

  test('VIS-LAB-01: Light, 1280', async ({ page }) => {
    await running(page, 'light');
    await expect(page).toHaveScreenshot('lab-light-1280.png');
  });

  test('VIS-LAB-02: Dark, 1280', async ({ page }) => {
    await running(page, 'dark');
    await expect(page).toHaveScreenshot('lab-dark-1280.png');
  });

  test('VIS-LAB-03: Light, 390, no horizontal scroll', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await running(page, 'light');
    expect(await noHorizontalScroll(page)).toBeLessThanOrEqual(0);
    await expect(page).toHaveScreenshot('lab-light-390.png');
  });

  test('VIS-LAB-04: Dark, 390, no horizontal scroll', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await running(page, 'dark');
    expect(await noHorizontalScroll(page)).toBeLessThanOrEqual(0);
    await expect(page).toHaveScreenshot('lab-dark-390.png');
  });
});

test.describe("VIS-LAB: the Lab's Share dialog", () => {
  test.skip(!LAB_RUNTIME_LOCAL, 'Needs the local runtime build: LAB_RUNTIME_LOCAL=1');
  test.use({ serviceWorkers: 'block' });

  test.beforeAll(() => requireRuntime());

  for (const theme of ['light', 'dark'] as const) {
    test(`VIS-LAB-06: Share dialog, ${theme}, 1280`, async ({ page }) => {
      // The store request is answered here with a fixed id, so the link is the same on every run and nothing leaves the machine.
      await page.route('**/api/share', (route) =>
        route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 'k3x9q2Ab', expiresAt: '2027-01-14T00:00:00.000Z' }) }),
      );
      await routeLab(page.context());
      await openLab(page, theme);
      await page.getByRole('button', { name: 'Share' }).click();
      await expect(page.getByRole('textbox', { name: 'Link' })).toHaveValue(/\/s\/k3x9q2Ab$/);
      await expect(page.getByRole('dialog')).toContainText('Stored for 90 days, until 14 Jan 2027.');
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      await expect(page).toHaveScreenshot(`lab-share-${theme}-1280.png`);
    });
  }
});

test.describe('VIS-LAB-18: /lab paints styled from its first frame', () => {
  test.use({ serviceWorkers: 'block' });

  test("the wordmark keeps the editor's 23 px height on every frame while the page loads, opened directly or from the header", async ({ page }) => {
    await routeLab(page.context());
    // Every frame from the first, the wordmark's height, while it is in the page.
    await page.addInitScript(() => {
      const seen: number[] = [];
      (window as unknown as { __wordHeights: number[] }).__wordHeights = seen;
      const tick = () => {
        const word = document.querySelector('.lab-top-bar .vams-logo__word');
        if (word) seen.push(Math.round(word.getBoundingClientRect().height));
        if (performance.now() < 4000) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    const heights = () => page.evaluate(() => (window as unknown as { __wordHeights: number[] }).__wordHeights);
    for (const open of [() => page.goto('/lab'), async () => { await page.goto('/'); await page.locator('a[href="/lab"]').first().click(); }]) {
      await open();
      await page.waitForSelector('.lab-top-bar .vams-logo__word');
      await page.waitForTimeout(2000);
      const seen = await heights();
      expect(seen.length).toBeGreaterThan(10);
      expect(Math.max(...seen)).toBeLessThanOrEqual(23);
    }
  });
});
