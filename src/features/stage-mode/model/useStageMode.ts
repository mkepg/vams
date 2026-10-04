import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { toggleTheme } from '@/shared/lib/theme';
import { clampIndex, focusKind, keyToAction, nextIndex, prevIndex, readStageFromUrl } from './stage-controller';

export interface StageMode {
  active: boolean;
  /** True after the first client render; the indicator waits for it so hydration matches the prerender. */
  ready: boolean;
  index: number;
  count: number;
  enter: () => void;
  exit: () => void;
}

function prefersReducedMotion() {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function scrollToSection(id: string, smooth: boolean) {
  document.getElementById(id)?.scrollIntoView?.({
    behavior: smooth && !prefersReducedMotion() ? 'smooth' : 'auto',
    block: 'start',
  });
}

/** The section whose top edge is closest to the top of the viewport. */
function nearestSectionIndex(sectionIds: readonly string[]) {
  let best = 0;
  let bestDistance = Infinity;
  sectionIds.forEach((id, i) => {
    const el = document.getElementById(id);
    if (!el) return;
    const distance = Math.abs(el.getBoundingClientRect().top);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = i;
    }
  });
  return best;
}

function toggleFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen?.()?.catch(() => {});
    return;
  }
  document.documentElement.requestFullscreen?.()?.catch(() => {});
}

function initialStage(sectionIds: readonly string[]) {
  if (typeof window === 'undefined') return { active: false, index: 0 };
  return readStageFromUrl(window.location.search, window.location.hash, sectionIds);
}

/**
 * Presents the page as slides. `sectionIds` must be a stable array (a module constant): it lists
 * the slide sections in order. `onEnterApp` runs when the presenter steps past the last slide.
 */
export function useStageMode(sectionIds: readonly string[], onEnterApp: () => void): StageMode {
  const count = sectionIds.length;
  // Read the URL during the first client render so a /?stage load never drops the stage class
  // that the early inline script already set. Only the indicator depends on this state, and it
  // waits for `ready`.
  const [initial] = useState(() => initialStage(sectionIds));
  const [active, setActive] = useState(initial.active);
  const [index, setIndex] = useState(initial.index);
  const [ready, setReady] = useState(false);

  const activeRef = useRef(active);
  const indexRef = useRef(index);
  const enterAppRef = useRef(onEnterApp);
  const pendingScrollRef = useRef(initial.active);
  const urlTouchedRef = useRef(initial.active);

  // Mirror the latest state and callback for the window key handler. This runs first in every
  // commit, before the layout effect below reads indexRef to re-anchor the slide.
  useLayoutEffect(() => {
    activeRef.current = active;
    indexRef.current = index;
    enterAppRef.current = onEnterApp;
  });

  // A second pass after hydration, so the indicator never mismatches the prerendered HTML.
  useEffect(() => setReady(true), []);

  const enter = useCallback(() => {
    if (activeRef.current) return;
    setIndex(nearestSectionIndex(sectionIds));
    pendingScrollRef.current = true;
    setActive(true);
  }, [sectionIds]);

  const exit = useCallback(() => {
    if (!activeRef.current) return;
    pendingScrollRef.current = true;
    setActive(false);
  }, []);

  const goTo = useCallback(
    (target: number) => {
      const next = clampIndex(target, count);
      setIndex(next);
      scrollToSection(sectionIds[next], true);
    },
    [count, sectionIds],
  );

  // Apply the layout class, then re-anchor on the current slide, because entering or leaving
  // changes every section's height.
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('stage', active);
    if (pendingScrollRef.current) {
      pendingScrollRef.current = false;
      scrollToSection(sectionIds[indexRef.current], false);
    }
    return () => root.classList.remove('stage');
  }, [active, sectionIds]);

  // Keep ?stage and the slide hash in the URL so a reload during rehearsal returns to the same slide.
  useEffect(() => {
    if (!active && !urlTouchedRef.current) return;
    urlTouchedRef.current = active;
    const { pathname } = window.location;
    const hash = `#${sectionIds[index]}`;
    window.history.replaceState(window.history.state, '', active ? `${pathname}?stage${hash}` : `${pathname}${hash}`);
  }, [active, index, sectionIds]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const current = indexRef.current;
      const action = keyToAction(event, {
        active: activeRef.current,
        atLast: current === count - 1,
        focus: focusKind(document.activeElement),
      });
      if (!action) return;
      event.preventDefault();
      switch (action) {
        case 'enter-stage':
          enter();
          break;
        case 'exit':
          exit();
          break;
        case 'next':
          goTo(nextIndex(current, count));
          break;
        case 'prev':
          goTo(prevIndex(current));
          break;
        case 'first':
          goTo(0);
          break;
        case 'last':
          goTo(count - 1);
          break;
        case 'theme':
          toggleTheme();
          break;
        case 'fullscreen':
          toggleFullscreen();
          break;
        case 'enter-app':
          enterAppRef.current();
          break;
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [count, enter, exit, goTo]);

  // Follow mouse-wheel and touch scrolling while presenting.
  useEffect(() => {
    if (!active || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const i = sectionIds.indexOf((entry.target as HTMLElement).id);
          if (i >= 0) setIndex(i);
        }
      },
      { threshold: 0.6 },
    );
    for (const id of sectionIds) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [active, sectionIds]);

  return { active, ready, index, count, enter, exit };
}
