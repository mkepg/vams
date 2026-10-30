/**
 * VISUAL TEST SUITE — VIS-LB
 * Screenshot checks for the lesson bar's goals, hints and Skip, on the goals sample lesson
 * (built in only when VITE_LESSON_SAMPLES=1), and a layout check on the longest fill-in line in
 * Write the Texture Calls. Not part of `npm test`.
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
      // A prediction step lights Next once an option is picked.
      const prediction = page.getByRole('group', { name: 'Your prediction' });
      if (await prediction.isVisible()) await prediction.getByRole('button').first().click();
      await expect(next).toBeEnabled();
      await next.click();
      await expect.poll(async () => bar.innerText()).not.toBe(before);
    }
    await expect(next).toContainText('Vector vs Raster');
    await expect(bar).toHaveScreenshot(`lb-recap-next-named-${theme}-1280.png`);
  });
}

async function openPredictStep(page: import('@playwright/test').Page, theme: (typeof THEMES)[number]) {
  await openLesson(page, 'sample-predict', theme);
  await page.getByRole('button', { name: /^Next/ }).click();
  await expect(page.locator('.lesson-bar')).toContainText('Step 2 of 3');
  await expect(page.getByRole('group', { name: 'Your prediction' }).getByRole('button')).toHaveCount(4);
}

for (const theme of THEMES) {
  test(`VIS-LB-06: prediction step before a pick, ${theme}, 1280`, async ({ page }) => {
    await openPredictStep(page, theme);
    await expect(page.locator('.lesson-bar')).toHaveScreenshot(`lb-predict-open-${theme}-1280.png`);
  });

  test(`VIS-LB-07: prediction step after picking Up, ${theme}, 1280`, async ({ page }) => {
    await openPredictStep(page, theme);
    await page.getByRole('group', { name: 'Your prediction' }).getByRole('button', { name: 'Up' }).click();
    const verdict = page.locator('.lesson-bar__verdict');
    await expect(verdict).toContainText('Up');
    await expect(verdict).toContainText('up would be Y');
    await expect(page.locator('.lesson-bar__next')).toBeEnabled();
    await expect(page.locator('.lesson-bar')).toHaveScreenshot(`lb-predict-wrong-${theme}-1280.png`);
  });
}

async function openCodeStep(page: import('@playwright/test').Page, theme: (typeof THEMES)[number]) {
  await openLesson(page, 'sample-code', theme);
  await page.getByRole('button', { name: /^Next/ }).click();
  await expect(page.locator('.lesson-bar')).toContainText('Step 2 of 3');
  await expect(page.locator('.lesson-code')).toBeVisible();
  await page.addStyleTag({ content: '* { caret-color: transparent !important; }' });
}

for (const theme of THEMES) {
  test(`VIS-LB-08: fill-in step, 0.5 right and 0.3 wrong, blurred, ${theme}, 1280`, async ({ page }) => {
    await openCodeStep(page, theme);
    const blank1 = page.getByLabel('Blank 1 of 2');
    const blank2 = page.getByLabel('Blank 2 of 2');
    await blank1.fill('0.5');
    await blank2.fill('0.3');
    await blank2.blur();
    await expect(blank1).not.toBeFocused();
    await expect(blank2).not.toBeFocused();
    await expect(blank1).toHaveClass(/is-right/);
    await expect(blank2).toHaveClass(/is-wrong/);
    await expect(page.locator('.lesson-bar')).toContainText("that's not Y");
    await expect(page.locator('.lesson-bar')).toHaveScreenshot(`lb-code-wrong-${theme}-1280.png`);
  });

  test(`VIS-LB-09: fill-in step, blank 2 focused with 0.2, ${theme}, 1280`, async ({ page }) => {
    await openCodeStep(page, theme);
    await page.getByLabel('Blank 1 of 2').fill('0.5');
    await page.getByLabel('Blank 2 of 2').fill('0.2');
    await expect(page.getByLabel('Blank 2 of 2')).toBeFocused();
    await expect(page.locator('.lesson-bar__next')).toBeEnabled();
    await expect(page.locator('.lesson-bar')).toHaveScreenshot(`lb-code-focus-${theme}-1280.png`);
  });
}

for (const width of [1280, 960]) {
  test(`VIS-LB-10: a long fill-in line scrolls inside the bar and leaves Next clickable, ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 720 });
    await openLesson(page, 'textures-exercise-6', 'light');
    // Step on to the glTexImage2D line. Clicks are dispatched so an earlier step's layout cannot stall the walk.
    for (let i = 0; i < 12 && !(await page.locator('.lesson-code', { hasText: 'glTexImage2D' }).count()); i++) {
      const next = page.locator('.lesson-bar__next');
      if (await next.isEnabled()) await next.dispatchEvent('click');
      else {
        await page.getByRole('button', { name: 'Stuck?' }).dispatchEvent('click');
        await page.getByRole('button', { name: 'Skip this step' }).dispatchEvent('click');
      }
      await page.waitForTimeout(150);
    }
    await expect(page.locator('.lesson-code')).toContainText('glTexImage2D');
    await page.getByLabel('Blank 1 of 2').fill('GL_RGBA');
    await page.getByLabel('Blank 2 of 2').fill('GL_UNSIGNED_BYTE');
    await page.getByLabel('Blank 2 of 2').blur();
    await expect(page.locator('.lesson-bar__next')).toBeEnabled();

    const area = (await page.locator('.editor__canvas').boundingBox())!;
    const bar = (await page.locator('.lesson-bar').boundingBox())!;
    expect(bar.x + bar.width).toBeLessThanOrEqual(area.x + area.width + 0.5);
    const well = page.locator('.lesson-code');
    expect(await well.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
    // A trial click fails if anything covers Next.
    await page.locator('.lesson-bar__next').click({ trial: true, timeout: 2000 });
  });
}
