/**
 * VISUAL TEST SUITE — VIS-SHARE
 * The Share dialog and the phone scene view, for the approved mocks' scene. Not part of `npm test`.
 */
import { test, expect, type Page } from '@playwright/test';
import { openMockScene } from './helpers/mock-scene';

const HIDE_TIMED = '.update-notice, [data-sonner-toaster] { display: none !important; }';

/** Answers the store request as the server does, so the dialog shows the short link. */
async function routeStore(page: Page) {
  await page.route('**/api/share', (route) =>
    route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 'k3x9q2Ab', expiresAt: '2027-01-14T00:00:00.000Z' }) }),
  );
}

/** Opens the Share dialog and waits for the link. */
async function openShareDialog(page: Page, pattern: RegExp = /\/s\//) {
  await page.getByRole('button', { name: 'Share' }).click();
  const link = page.getByRole('textbox', { name: 'Link' });
  await expect(link).toHaveValue(pattern);
  return link.inputValue();
}

for (const theme of ['dark', 'light'] as const) {
  test(`VIS-SHARE-01: Share dialog, stored link for the mocks' scene, ${theme}, 1280`, async ({ page }) => {
    await routeStore(page);
    await openMockScene(page, theme);
    await openShareDialog(page);
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Stored for 90 days, until 14 Jan 2027.');
    await expect(dialog).toHaveScreenshot(`share-dialog-${theme}-1280.png`);
    await expect(page).toHaveScreenshot(`share-editor-${theme}-1280.png`);
  });
}

for (const theme of ['dark', 'light'] as const) {
  test(`VIS-SHARE-02: Scene view from a carried link at 390 x 844, ${theme}`, async ({ browser }) => {
    const editor = await browser.newPage();
    await openMockScene(editor, theme);
    // Storing is refused so the dialog gives the carried link, which this view opens without a server.
    await editor.route('**/api/share', (route) => route.abort());
    const url = await openShareDialog(editor, /#s=/);
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
