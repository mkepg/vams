/**
 * VISUAL TEST SUITE — VIS-LAB (the Lab's look)
 * Screenshot checks for /lab with the template program running, at 1280 and 390 px, in both
 * themes. The template compiles through the compile service's image, so the checks need Docker:
 * LAB_DOCKER=1 npm run test:visual -- lab.spec lab-drawing. Without it they skip. Not part of `npm test`.
 */
import { expect, test, type Page } from '@playwright/test';
import { LAB_DOCKER, openLab, routeLab, runProgram, startCompileService, type CompileService, type Theme } from './helpers/lab';

test.describe('VIS-LAB: the Lab with the template running', () => {
  test.skip(!LAB_DOCKER, 'Needs Docker: LAB_DOCKER=1');
  // Each check compiles; the first may also build the image.
  test.describe.configure({ timeout: 120_000 });
  test.use({ serviceWorkers: 'block' });

  let service: CompileService;
  test.beforeAll(async () => {
    test.setTimeout(900_000);
    service = await startCompileService();
  });
  test.afterAll(() => service?.stop());

  async function running(page: Page, theme: Theme) {
    await routeLab(page.context(), service);
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
