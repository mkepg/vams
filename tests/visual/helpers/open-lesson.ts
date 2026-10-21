/**
 * Opens a lesson in the editor for the visual specs: theme seeded, first-visit welcome skipped,
 * timed notices hidden. Not part of `npm test`.
 */
import type { Page } from '@playwright/test';

type Theme = 'light' | 'dark';

const HIDE_TIMED_NOTICES =
  '.update-notice, [data-sonner-toaster] { display: none !important; } .scene-title__state { visibility: hidden !important; }';

export async function openLesson(page: Page, lessonId: string, theme: Theme) {
  await page.addInitScript(
    ({ t, css }) => {
      window.localStorage.setItem('vams-theme', t);
      window.localStorage.setItem('vams-storage', JSON.stringify({ state: { hasSeenWelcome: true }, version: 11 }));
      const inject = () => {
        const style = document.createElement('style');
        style.textContent = css;
        (document.head ?? document.documentElement).appendChild(style);
      };
      if (document.documentElement) inject();
      else document.addEventListener('DOMContentLoaded', inject, { once: true });
    },
    { t: theme, css: HIDE_TIMED_NOTICES },
  );
  await page.goto(`/app?lesson=${lessonId}`);
  await page.waitForSelector('.lesson-bar');
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
}
