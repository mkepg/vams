/**
 * VISUAL TEST SUITE — VIS-LB
 * Screenshot checks for the lesson bar's goals, hints and Skip, on the goals sample lesson
 * (built in only when VITE_LESSON_SAMPLES=1). Not part of `npm test`.
 */
import { test, expect } from '@playwright/test';
import { openLesson } from './helpers/open-lesson';

const THEMES = ['dark', 'light'] as const;

for (const theme of THEMES) {
  test(`VIS-LB-01: goals step as it opens, one goal met, ${theme}, 1280`, async ({ page }) => {
    await openLesson(page, 'sample-goals', theme);
    await expect(page.locator('.lesson-bar')).toContainText('Stuck?');
    await expect(page.locator('.lesson-bar')).toHaveScreenshot(`lb-goals-open-${theme}-1280.png`);
  });

  test(`VIS-LB-02: Stuck? opened and one hint shown, ${theme}, 1280`, async ({ page }) => {
    await openLesson(page, 'sample-goals', theme);
    await page.getByRole('button', { name: 'Stuck?' }).click();
    await page.getByRole('button', { name: 'Show a hint' }).click();
    await expect(page.getByRole('button', { name: 'Show another hint' })).toBeVisible();
    await expect(page.locator('.lesson-bar')).toHaveScreenshot(`lb-goals-hint-${theme}-1280.png`);
  });

  test(`VIS-LB-03: after Skip, every goal met and Next lit, ${theme}, 1280`, async ({ page }) => {
    await openLesson(page, 'sample-goals', theme);
    await page.getByRole('button', { name: 'Stuck?' }).click();
    await page.getByRole('button', { name: 'Skip this step' }).click();
    await expect(page.locator('.lesson-bar__next')).toBeEnabled();
    await expect(page.locator('.lesson-bar')).toHaveScreenshot(`lb-goals-skipped-${theme}-1280.png`);
  });
}
