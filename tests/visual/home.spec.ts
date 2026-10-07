/**
 * VISUAL TEST SUITE — VIS-HOME
 * Stage-mode legibility on a projector-sized window. Not part of `npm test`.
 */
import { test, expect } from '@playwright/test';

const BODY = [
  '.home__lede',
  '.home-section__subhead',
  '.problem-list > li',
  '.pipeline__summary',
  '.mode-list dd',
  '.hood-list dd',
  '.team-list dd',
  '.try-note',
];

test('VIS-HOME-01: Stage mode body text is at least 20px at 1280 x 720', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/?stage');
  await page.evaluate(() => document.fonts.ready);
  for (const selector of BODY) {
    const sizes = await page.$$eval(selector, (els) => els.map((el) => parseFloat(getComputedStyle(el).fontSize)));
    expect(sizes.length, selector).toBeGreaterThan(0);
    for (const size of sizes) expect(size, selector).toBeGreaterThanOrEqual(20);
  }
});
