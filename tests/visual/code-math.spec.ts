/**
 * VISUAL TEST SUITE — VIS-CM
 * The code panel and the math journey in the approved mocks' scene. Not part of `npm test`.
 */
import { test, expect } from '@playwright/test';
import { openMockScene } from './helpers/mock-scene';

for (const theme of ['dark', 'light'] as const) {
  test(`VIS-CM-01: Code pane, Triangle selected and X just changed, ${theme}, 1280`, async ({ page }) => {
    await openMockScene(page, theme);
    // Reduced motion holds the wash still for 2 s, so the stable screenshot is taken while the mark shows.
    await expect(page.locator('.code-math-column')).toHaveScreenshot(`cm-code-${theme}-1280.png`, { animations: 'allow' });
    await expect(page).toHaveScreenshot(`cm-editor-code-${theme}-1280.png`, { animations: 'allow' });
  });
}

for (const theme of ['dark', 'light'] as const) {
  test(`VIS-CM-02: Math pane, Transformed open, following vertex 1, ${theme}, 1280`, async ({ page }) => {
    await openMockScene(page, theme);
    await page.getByRole('radio', { name: 'Math' }).click();
    await expect(page.locator('.journey-open__title')).toHaveText('Transformed');
    await expect(page.locator('.code-math-column')).toHaveScreenshot(`cm-journey-transformed-${theme}-1280.png`);
    await expect(page).toHaveScreenshot(`cm-editor-math-${theme}-1280.png`);
  });
}

for (const stage of ['Projected', 'Coloured'] as const) {
  test(`VIS-CM-03: Math pane, ${stage} open, dark, 1280`, async ({ page }) => {
    await openMockScene(page, 'dark');
    await page.getByRole('radio', { name: 'Math' }).click();
    await page.locator('.journey-stage__row', { hasText: stage }).click();
    await expect(page.locator('.journey-open__title')).toHaveText(stage);
    await expect(page.locator('.code-math-column')).toHaveScreenshot(`cm-journey-${stage.toLowerCase()}-dark-1280.png`);
  });
}

const STAGES = ['Stored', 'Transformed', 'Projected', 'Assembled', 'Rasterised', 'Coloured'] as const;

for (const theme of ['dark', 'light'] as const) {
  test(`VIS-CM-06: Math pane, every stage open in turn, ${theme}, 1280`, async ({ page }) => {
    await openMockScene(page, theme);
    await page.getByRole('radio', { name: 'Math' }).click();
    for (const stage of STAGES) {
      // The open stage has no closed row to click; the scene opens on Transformed.
      const row = page.locator('.journey-stage__row', { hasText: stage });
      if ((await row.count()) > 0) await row.click();
      await expect(page.locator('.journey-open__title')).toHaveText(stage);
      await expect(page.locator('.code-math-column')).toHaveScreenshot(`cm-stage-${stage.toLowerCase()}-${theme}-1280.png`);
    }
  });
}

for (const theme of ['dark', 'light'] as const) {
  test(`VIS-CM-04: Code pane with notes and the strip open on glTranslatef, ${theme}, 1280`, async ({ page }) => {
    await openMockScene(page, theme);
    await page.locator('.code-line', { hasText: 'glTranslatef(state_Triangle.x' }).click();
    await expect(page.locator('.code-strip__sig')).toHaveText('glTranslatef(x, y, z)');
    await expect(page.locator('.code-math-column')).toHaveScreenshot(`cm-code-strip-${theme}-1280.png`, { animations: 'allow' });
  });
}

test('VIS-CM-05: The followed vertex ringed on the canvas with Math showing, dark, 1280', async ({ page }) => {
  await openMockScene(page, 'dark');
  await page.getByRole('radio', { name: 'Math' }).click();
  await expect(page).toHaveScreenshot('cm-editor-ring-dark-1280.png');
});
