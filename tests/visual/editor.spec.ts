/**
 * VISUAL TEST SUITE — VIS-EDITOR
 * Screenshot regression checks for the editor layout. Not part of `npm test`.
 */
import { test, expect, type Page } from '@playwright/test';

type Theme = 'light' | 'dark';

// Timed notices stay out of screenshots: the offline notice appears once the service worker
// installs, and toasts appear on their own schedule.
const HIDE_TIMED_NOTICES =
  '.update-notice, [data-sonner-toaster] { display: none !important; } .scene-title__state { visibility: hidden !important; }';

async function open(page: Page, path: string, theme: Theme = 'light') {
  await page.addInitScript(
    ({ t, css }) => {
      window.localStorage.setItem('vams-theme', t);
      // Injected before any app script runs, so a notice never paints even for one frame.
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
  await page.goto(path);
  await page.waitForSelector('.editor');
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
}

test('VIS-EDITOR-01: Transforms scene, light, 1280', async ({ page }) => {
  await open(page, '/app?scene=transforms');
  await expect(page).toHaveScreenshot('transforms-light-1280.png');
});

test('VIS-EDITOR-02: Transforms scene, dark, 1280', async ({ page }) => {
  await open(page, '/app?scene=transforms', 'dark');
  await expect(page).toHaveScreenshot('transforms-dark-1280.png');
});

test('VIS-EDITOR-03: Primitives tour, 1280', async ({ page }) => {
  await open(page, '/app?scene=primitives');
  await expect(page).toHaveScreenshot('primitives-1280.png');
});

test('VIS-EDITOR-04: Textured quad, 1280', async ({ page }) => {
  await open(page, '/app?scene=textured-quad');
  await expect(page).toHaveScreenshot('textured-quad-1280.png');
});

test('VIS-EDITOR-05: Lesson column, light and dark', async ({ page }) => {
  await open(page, '/app?lesson=transforms-exercise-1');
  await expect(page).toHaveScreenshot('lesson-light-1280.png');
  await open(page, '/app?lesson=transforms-exercise-1', 'dark');
  await expect(page).toHaveScreenshot('lesson-dark-1280.png');
});

test('VIS-EDITOR-06: Lesson quiz step', async ({ page }) => {
  // Quiz questions and answer order are drawn at random; fix the generator so the card is the same on every run.
  await page.addInitScript(() => {
    let seed = 1;
    Math.random = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
  });
  await open(page, '/app?lesson=pipeline-exercise-2');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page).toHaveScreenshot('lesson-quiz-1280.png');
});

test('VIS-EDITOR-07: Narrow layout, drawer closed and open', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await open(page, '/app?scene=transforms');
  await expect(page).toHaveScreenshot('narrow-closed-960.png');
  await page.getByRole('tab', { name: 'Scene' }).click();
  await expect(page).toHaveScreenshot('narrow-open-960.png');
});

test('VIS-EDITOR-08: Menus, the Learn drawer and the My scenes dialog', async ({ page }) => {
  await open(page, '/app?scene=transforms');
  await page.getByRole('button', { name: 'File' }).click();
  await expect(page).toHaveScreenshot('file-menu.png');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Learn' }).click();
  await expect(page).toHaveScreenshot('learn-drawer.png');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'File' }).click();
  await page.getByRole('menuitem', { name: 'My scenes…' }).click();
  // The name field starts with a timestamp; fix it so the capture does not change by the minute.
  await page.getByRole('dialog').getByRole('textbox').fill('Scene name');
  await expect(page).toHaveScreenshot('my-scenes.png');
});

test('VIS-EDITOR-09: No horizontal page overflow at 960 px', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await open(page, '/app?scene=transforms');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('VIS-EDITOR-10: An empty scene opens the Add panel, light, 1280', async ({ page }) => {
  await open(page, '/app');
  // A first visit opens the welcome card over the editor; dismiss it so the capture shows the Add panel.
  await page.getByRole('button', { name: 'Start building' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page).toHaveScreenshot('add-empty-light-1280.png');
});

test('VIS-EDITOR-11: Learn drawer, dark, 1280', async ({ page }) => {
  await open(page, '/app?scene=transforms', 'dark');
  await page.getByRole('button', { name: 'Learn' }).click();
  await expect(page).toHaveScreenshot('learn-dark-1280.png');
});

test('VIS-EDITOR-12: A selected object shows its inspector groups, light, 1280', async ({ page }) => {
  await open(page, '/app?scene=transforms');
  // A leaf row is a primitive, so the inspector shows the full set of object groups.
  await page.locator('[data-panel-id="scene-hierarchy"] [role="treeitem"]:not([aria-expanded]) .tree-item').first().click();
  await expect(page.locator('.inspector__meta')).toContainText('GL_');
  await expect(page).toHaveScreenshot('selected-light-1280.png');
});

test('VIS-EDITOR-13: A demo step outlines its group and dims the rest, dark, 1280', async ({ page }) => {
  // Tall enough that the dimmed groups below the open Transform group are in the capture.
  await page.setViewportSize({ width: 1280, height: 1100 });
  await open(page, '/app?lesson=transforms-demo-1', 'dark');
  // Step 2 focuses the Transform group.
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.locator('[data-group="transform"].is-focus')).toBeVisible();
  await expect(page.locator('.inspector-group.is-dimmed').first()).toBeVisible();
  await expect(page).toHaveScreenshot('demo-dimmed-dark-1280.png');
});

async function callbacksWithRules(page: Page) {
  await page.getByRole('tab', { name: /^Callbacks/ }).click();
  const special = page.locator('.cb-item', { has: page.locator('.cb-label', { hasText: 'Special keys' }) });
  await special.locator('.cb-toggle').click();
  await special.getByRole('button', { name: 'Add rule' }).click();
  await special.getByRole('button', { name: 'Done' }).click();
  await special.getByRole('button', { name: 'Add rule' }).click();
  return special;
}

test('VIS-EDITOR-14: Callbacks panel with rules and an open form, light, 1280', async ({ page }) => {
  await open(page, '/app?scene=primitives');
  const special = await callbacksWithRules(page);
  await expect(special.locator('.cb-rule-form')).toBeVisible();
  await expect(page).toHaveScreenshot('callbacks-rules-light-1280.png');
});

for (const theme of ['light', 'dark'] as const) {
  test(`VIS-EDITOR-${theme === 'light' ? '15' : '16'}: Run after pressing →, ${theme}, 1280`, async ({ page }) => {
    await open(page, '/app?scene=primitives', theme);
    const special = await callbacksWithRules(page);
    await special.getByRole('button', { name: 'Done' }).click();
    await page.locator('.run-button').click();
    await expect(page.locator('.run-strip')).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.run-readout')).toContainText('GLUT_KEY_RIGHT');
    await expect(page).toHaveScreenshot(`run-${theme}-1280.png`, { animations: 'disabled' });
  });
}

const THEMES = ['light', 'dark'] as const;

/** Opens an empty editor and closes the first-visit welcome card. */
async function openEmpty(page: Page, theme: Theme) {
  await open(page, '/app', theme);
  await page.getByRole('button', { name: 'Start building' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
}

/** Opens the Transforms scene with its first leaf object selected. */
async function openSelected(page: Page, theme: Theme) {
  await open(page, '/app?scene=transforms', theme);
  await page.locator('[data-panel-id="scene-hierarchy"] [role="treeitem"]:not([aria-expanded]) .tree-item').first().click();
  await expect(page.locator('.inspector__meta')).toContainText('GL_');
}

/** Quiz order is drawn at random; fix the generator so the bar is the same on every run. */
async function seedRandom(page: Page) {
  await page.addInitScript(() => {
    let seed = 1;
    Math.random = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
  });
}

for (const theme of THEMES) {
  test(`VIS-EDITOR-17: Add panel, ${theme}, 1280`, async ({ page }) => {
    await openEmpty(page, theme);
    await expect(page.getByRole('tab', { name: 'Add' })).toHaveAttribute('aria-selected', 'true');
    await expect(page).toHaveScreenshot(`panel-add-${theme}-1280.png`);
  });

  test(`VIS-EDITOR-18: Scene panel with a selection, ${theme}, 1280`, async ({ page }) => {
    await openSelected(page, theme);
    await expect(page).toHaveScreenshot(`panel-scene-${theme}-1280.png`);
  });

  test(`VIS-EDITOR-19: Settings panel, ${theme}, 1280`, async ({ page }) => {
    await open(page, '/app?scene=transforms', theme);
    await page.getByRole('tab', { name: 'Settings' }).click();
    await expect(page).toHaveScreenshot(`panel-settings-${theme}-1280.png`);
  });

  test(`VIS-EDITOR-20: Callbacks panel, ${theme}, 1280`, async ({ page }) => {
    await open(page, '/app?scene=primitives', theme);
    await page.getByRole('tab', { name: /^Callbacks/ }).click();
    await expect(page).toHaveScreenshot(`panel-callbacks-${theme}-1280.png`);
  });

  test(`VIS-EDITOR-21: Lesson bar on a demo step, ${theme}, 1280`, async ({ page }) => {
    await open(page, '/app?lesson=transforms-demo-1', theme);
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page.locator('.lesson-bar__step')).toContainText('Step 2');
    await expect(page).toHaveScreenshot(`lesson-bar-demo-${theme}-1280.png`);
  });

  test(`VIS-EDITOR-22: Lesson bar waiting on an exercise, ${theme}, 1280`, async ({ page }) => {
    await open(page, '/app?lesson=transforms-exercise-1', theme);
    await expect(page.locator('.lesson-bar__task')).toContainText('Waiting for you');
    await expect(page).toHaveScreenshot(`lesson-bar-exercise-${theme}-1280.png`);
  });

  test(`VIS-EDITOR-23: Lesson bar quiz, ${theme}, 1280`, async ({ page }) => {
    await seedRandom(page);
    await open(page, '/app?lesson=pipeline-exercise-2', theme);
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page).toHaveScreenshot(`lesson-bar-quiz-${theme}-1280.png`);
  });

  test(`VIS-EDITOR-24: Lesson bar folded, ${theme}, 1280`, async ({ page }) => {
    await open(page, '/app?lesson=transforms-demo-1', theme);
    await page.getByRole('button', { name: 'Fold lesson' }).click();
    await expect(page.getByRole('button', { name: 'Unfold lesson' })).toBeVisible();
    await expect(page).toHaveScreenshot(`lesson-bar-folded-${theme}-1280.png`);
  });

  test(`VIS-EDITOR-25: Math pane, ${theme}, 1280`, async ({ page }) => {
    await openSelected(page, theme);
    await page.getByRole('radio', { name: 'Math' }).click();
    await expect(page.getByRole('radio', { name: 'Math' })).toHaveAttribute('aria-checked', 'true');
    await expect(page).toHaveScreenshot(`math-pane-${theme}-1280.png`);
  });

  test(`VIS-EDITOR-26: Panel hidden, ${theme}, 1280`, async ({ page }) => {
    await open(page, '/app?scene=transforms', theme);
    await page.getByRole('button', { name: 'Hide', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Show', exact: true })).toBeVisible();
    await expect(page).toHaveScreenshot(`panel-hidden-${theme}-1280.png`);
  });

  test(`VIS-EDITOR-27: Code and math hidden, ${theme}, 1280`, async ({ page }) => {
    await open(page, '/app?scene=transforms', theme);
    await page.getByRole('button', { name: 'Hide code and math' }).click();
    await expect(page.getByRole('button', { name: 'Show code and math' })).toBeVisible();
    await expect(page).toHaveScreenshot(`code-hidden-${theme}-1280.png`);
  });

  test(`VIS-EDITOR-28: First-visit tour, Build step, ${theme}, 1280`, async ({ page }) => {
    await open(page, '/app', theme);
    await page.getByRole('button', { name: 'Take the tour' }).click();
    await expect(page.locator('.tour-callout')).toContainText('Step 1 of 6');
    await expect(page).toHaveScreenshot(`tour-build-${theme}-1280.png`, { animations: 'disabled' });
  });
}

test('VIS-EDITOR-29: Lesson bar above the open drawer, 960', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await open(page, '/app?lesson=transforms-demo-1');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.locator('.lesson-bar__step')).toContainText('Step 2');
  await expect(page.locator('.editor__panel')).toBeVisible();
  await expect(page).toHaveScreenshot('lesson-drawer-960.png', { animations: 'disabled' });
});
