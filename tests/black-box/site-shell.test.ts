/**
 * BLACK-BOX TEST SUITE — BB-SITE
 * Site shell: theming, route metadata and SEO output, prerendering, site chrome.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  readStoredTheme,
  getActiveTheme,
  setTheme,
  toggleTheme,
  subscribeTheme,
  toEditorTheme,
  THEME_STORAGE_KEY,
} from '@/shared/lib/theme';

function resetTheme() {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
}

describe('BB-SITE-01: Theme defaults to vellum', () => {
  beforeEach(resetTheme);
  it('returns vellum when nothing is stored', () => {
    expect(readStoredTheme()).toBe('vellum');
    expect(getActiveTheme()).toBe('vellum');
  });
});

describe('BB-SITE-02: Invalid stored theme values are ignored', () => {
  beforeEach(resetTheme);
  it('falls back to vellum for an unknown value', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    expect(readStoredTheme()).toBe('vellum');
  });
});

describe('BB-SITE-03: setTheme persists and applies the theme', () => {
  beforeEach(resetTheme);
  it('stores the value and sets data-theme on <html>', () => {
    setTheme('blueprint');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('blueprint');
    expect(document.documentElement.dataset.theme).toBe('blueprint');
    expect(getActiveTheme()).toBe('blueprint');
  });
});

describe('BB-SITE-04: toggleTheme flips themes and notifies subscribers', () => {
  beforeEach(resetTheme);
  it('alternates vellum and blueprint and stops notifying after unsubscribe', () => {
    const seen: string[] = [];
    const unsubscribe = subscribeTheme((theme) => seen.push(theme));
    expect(toggleTheme()).toBe('blueprint');
    expect(toggleTheme()).toBe('vellum');
    unsubscribe();
    toggleTheme();
    expect(seen).toEqual(['blueprint', 'vellum']);
  });
});

describe('BB-SITE-05: Site themes map onto the editor store values', () => {
  it('maps blueprint to dark and vellum to light', () => {
    expect(toEditorTheme('blueprint')).toBe('dark');
    expect(toEditorTheme('vellum')).toBe('light');
  });
});
