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

for (const theme of THEMES) {
  test(`VIS-LB-04: recap on a section's last step, bar reads Finish, ${theme}, 1280`, async ({ page }) => {
    await openLesson(page, 'sample-recap', theme);
    await page.getByRole('button', { name: /^Next/ }).click();
    const bar = page.locator('.lesson-bar');
    await expect(bar).toContainText('Step 2 of 2');
    await expect(bar.locator('.lesson-bar__learned li').first()).toBeVisible();
    await expect(page.locator('.lesson-bar__next')).toContainText('Finish');
    await expect(bar).toHaveScreenshot(`lb-recap-finish-${theme}-1280.png`);
  });

  test(`VIS-LB-05: last step of a lesson, button names the next lesson, ${theme}, 1280`, async ({ page }) => {
    await openLesson(page, 'pipeline-demo-1', theme);
    const bar = page.locator('.lesson-bar');
    const next = page.locator('.lesson-bar__next');
    for (let i = 0; i < 40 && !(await next.innerText()).includes('Vector vs Raster'); i++) {
      const before = await bar.innerText();
      await expect(next).toBeEnabled();
      await next.click();
      await expect.poll(async () => bar.innerText()).not.toBe(before);
    }
    await expect(next).toContainText('Vector vs Raster');
    await expect(bar).toHaveScreenshot(`lb-recap-next-named-${theme}-1280.png`);
  });
}
