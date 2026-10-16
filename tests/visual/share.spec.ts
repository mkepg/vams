/**
 * VISUAL TEST SUITE — VIS-SHARE
 * The Share dialog and the phone scene view, for the approved mocks' scene. Not part of `npm test`.
 */
import { test, expect, type Page } from '@playwright/test';
import { openMockScene } from './helpers/mock-scene';

const HIDE_TIMED = '.update-notice, [data-sonner-toaster] { display: none !important; }';

/** Opens the Share dialog and waits for the link. */
async function openShareDialog(page: Page) {
  await page.getByRole('button', { name: 'Share' }).click();
  const link = page.getByRole('textbox', { name: 'Link' });
  await expect(link).toHaveValue(/#s=/);
  return link.inputValue();
}

for (const theme of ['dark', 'light'] as const) {
  test(`VIS-SHARE-01: Share dialog, carried link for the mocks' scene, ${theme}, 1280`, async ({ page }) => {
    await openMockScene(page, theme);
    await openShareDialog(page);
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('This link carries your scene and never expires.');
    await expect(dialog).toHaveScreenshot(`share-dialog-${theme}-1280.png`);
    await expect(page).toHaveScreenshot(`share-editor-${theme}-1280.png`);
  });
}

for (const theme of ['dark', 'light'] as const) {
  test(`VIS-SHARE-02: Scene view from a carried link at 390 x 844, ${theme}`, async ({ browser }) => {
    const editor = await browser.newPage();
    await openMockScene(editor, theme);
    const url = await openShareDialog(editor);
    await editor.close();

    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    await context.addInitScript(
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
      { t: theme, css: HIDE_TIMED },
    );
    const page = await context.newPage();
    await page.goto(`/app${new URL(url).hash}`);
    await expect(page.locator('.scene-view__name')).toHaveText('Untitled scene');
    await expect(page.locator('.scene-view__window')).toBeVisible();
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    await page.waitForTimeout(600);
    await expect(page).toHaveScreenshot(`share-view-${theme}-390.png`);
    await context.close();
  });
}
