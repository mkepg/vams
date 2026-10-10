/**
 * BLACK-BOX TEST SUITE — BB-HOME
 * Landing page: the live vertex demo, stage mode, home content and structured data.
 */
import { describe, it, expect } from 'vitest';
import {
  INITIAL_TRIANGLE,
  FALLBACK_CODE,
  generateDemoCode,
  generateDemoProgram,
  extractDrawBlock,
  pixelToGl,
  glToPixel,
  snapToGrid,
  type DemoTriangle,
} from '@/pages/home/model/demo-code';

/** The block the editor's generator emits for the initial demo triangle (red, green, blue vertices). */
const INITIAL_BLOCK = [
  'glBegin(GL_TRIANGLES);',
  '    glColor3f(1.00f, 0.00f, 0.00f);',
  '    glVertex2f(-0.5000f, -0.5000f);',
  '    glColor3f(0.00f, 1.00f, 0.00f);',
  '    glVertex2f(0.5000f, -0.5000f);',
  '    glColor3f(0.00f, 0.00f, 1.00f);',
  '    glVertex2f(0.0000f, 0.5000f);',
  'glEnd();',
];

describe('BB-HOME-01: The demo shows the generator draw block for the initial triangle', () => {
  it('returns the glBegin…glEnd block and points at the three glVertex2f lines', () => {
    const code = generateDemoCode(INITIAL_TRIANGLE);
    expect(code.lines).toEqual(INITIAL_BLOCK);
    expect(code.vertexLineIndexes).toEqual([2, 4, 6]);
    // Extraction must succeed, otherwise the lines above could be the fallback block.
    expect(extractDrawBlock(generateDemoProgram(INITIAL_TRIANGLE))).not.toBeNull();
    expect(code).not.toBe(FALLBACK_CODE);
  });
});

describe('BB-HOME-02: The demo block is taken verbatim from the full generated program', () => {
  it('appears unchanged in the program and follows a moved vertex', () => {
    const moved: DemoTriangle = [{ x: 0.25, y: -0.75 }, INITIAL_TRIANGLE[1], INITIAL_TRIANGLE[2]];
    const program = generateDemoProgram(moved);
    const code = generateDemoCode(moved);
    expect(program).toContain(code.lines.map((line) => `    ${line}`).join('\n'));
    expect(code.lines[code.vertexLineIndexes[0]]).toBe('    glVertex2f(0.2500f, -0.7500f);');
  });
});

describe('BB-HOME-03: Pixel and GL coordinates convert both ways', () => {
  it('maps corners and the centre, and round-trips an arbitrary point', () => {
    expect(pixelToGl(0, 0, 300, 300)).toEqual({ x: -1, y: 1 });
    expect(pixelToGl(300, 300, 300, 300)).toEqual({ x: 1, y: -1 });
    expect(pixelToGl(150, 150, 300, 300)).toEqual({ x: 0, y: 0 });
    expect(glToPixel(0, 0.5, 300, 300)).toEqual({ px: 150, py: 75 });
    const p = glToPixel(-0.35, 0.8, 300, 300);
    const g = pixelToGl(p.px, p.py, 300, 300);
    expect(g.x).toBeCloseTo(-0.35, 10);
    expect(g.y).toBeCloseTo(0.8, 10);
  });
});

describe('BB-HOME-04: Dragged positions clamp to the view and snap to the grid', () => {
  it('clamps to [-1, 1], snaps to 0.05 and never returns negative zero', () => {
    expect(snapToGrid(1.3)).toBe(1);
    expect(snapToGrid(-2)).toBe(-1);
    expect(snapToGrid(0.123)).toBe(0.1);
    expect(snapToGrid(0.126)).toBe(0.15);
    expect(snapToGrid(-0.45 + 0.05)).toBe(-0.4);
    expect(Object.is(snapToGrid(-0.01), 0)).toBe(true);
  });
});

describe('BB-HOME-05: The demo falls back to a static block when extraction fails', () => {
  it('rejects programs without a complete block and keeps a fallback that matches the initial block', () => {
    expect(extractDrawBlock('int main() { return 0; }')).toBeNull();
    expect(extractDrawBlock('    glBegin(GL_TRIANGLES);\n')).toBeNull();
    expect(FALLBACK_CODE.lines).toEqual(INITIAL_BLOCK);
    expect(FALLBACK_CODE.vertexLineIndexes).toEqual([2, 4, 6]);
  });
});

import {
  keyToAction,
  nextIndex,
  prevIndex,
  clampIndex,
  readStageFromUrl,
  focusKind,
  type KeyContext,
} from '@/features/stage-mode/model/stage-controller';

type Mods = Partial<{ shiftKey: boolean; ctrlKey: boolean; altKey: boolean; metaKey: boolean }>;
const key = (k: string, mods: Mods = {}) => ({
  key: k,
  shiftKey: false,
  ctrlKey: false,
  altKey: false,
  metaKey: false,
  ...mods,
});
const MID: KeyContext = { active: true, atLast: false, focus: 'none' };

describe('BB-HOME-06: Stage keys step, jump, exit and toggle', () => {
  it('maps presenter and keyboard keys to stage actions mid-talk', () => {
    for (const k of ['ArrowRight', 'ArrowDown', 'PageDown', ' ']) expect(keyToAction(key(k), MID)).toBe('next');
    for (const k of ['ArrowLeft', 'ArrowUp', 'PageUp']) expect(keyToAction(key(k), MID)).toBe('prev');
    expect(keyToAction(key(' ', { shiftKey: true }), MID)).toBe('prev');
    expect(keyToAction(key('Home'), MID)).toBe('first');
    expect(keyToAction(key('End'), MID)).toBe('last');
    expect(keyToAction(key('Escape'), MID)).toBe('exit');
    expect(keyToAction(key('t'), MID)).toBe('theme');
    expect(keyToAction(key('T'), MID)).toBe('theme');
    expect(keyToAction(key('f'), MID)).toBe('fullscreen');
    expect(keyToAction(key('F'), MID)).toBe('fullscreen');
    expect(keyToAction(key('Enter'), MID)).toBeNull();
    expect(keyToAction(key('p'), MID)).toBeNull();
    expect(keyToAction(key('x'), MID)).toBeNull();
  });
});

describe('BB-HOME-07: Outside stage mode only P does anything', () => {
  it('enters on p or P and ignores every other key', () => {
    const off: KeyContext = { active: false, atLast: false, focus: 'none' };
    expect(keyToAction(key('p'), off)).toBe('enter-stage');
    expect(keyToAction(key('P'), off)).toBe('enter-stage');
    for (const k of ['ArrowRight', 'PageDown', ' ', 'Escape', 't', 'f', 'End']) expect(keyToAction(key(k), off)).toBeNull();
    expect(keyToAction(key('p'), { ...off, focus: 'text' })).toBeNull();
    expect(keyToAction(key('p', { ctrlKey: true }), off)).toBeNull();
  });
});

describe('BB-HOME-08: Keys yield to text fields, modifiers, vertex handles and controls', () => {
  it('ignores typing and shortcuts, and lets focused vertices and controls keep their keys', () => {
    for (const mods of [{ ctrlKey: true }, { altKey: true }, { metaKey: true }]) {
      expect(keyToAction(key('ArrowRight', mods), MID)).toBeNull();
    }
    expect(keyToAction(key('ArrowRight'), { ...MID, focus: 'text' })).toBeNull();
    expect(keyToAction(key('PageDown'), { ...MID, focus: 'text' })).toBeNull();
    const vertex: KeyContext = { ...MID, focus: 'vertex' };
    for (const k of ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown']) {
      expect(keyToAction(key(k), vertex)).toBeNull();
      expect(keyToAction(key(k, { shiftKey: true }), vertex)).toBeNull();
    }
    expect(keyToAction(key('PageDown'), vertex)).toBe('next');
    expect(keyToAction(key(' '), vertex)).toBe('next');
    expect(keyToAction(key('PageUp'), vertex)).toBe('prev');
    const control: KeyContext = { ...MID, focus: 'interactive' };
    expect(keyToAction(key(' '), control)).toBeNull();
    expect(keyToAction(key('Enter'), { ...control, atLast: true })).toBeNull();
    expect(keyToAction(key('PageDown'), control)).toBe('next');
  });
});

describe('BB-HOME-09: Stepping past the last slide opens the editor', () => {
  it('turns forward keys and Enter into enter-app on the last slide', () => {
    const last: KeyContext = { active: true, atLast: true, focus: 'none' };
    for (const k of ['ArrowRight', 'ArrowDown', 'PageDown', ' ']) expect(keyToAction(key(k), last)).toBe('enter-app');
    expect(keyToAction(key('Enter'), last)).toBe('enter-app');
    expect(keyToAction(key('ArrowLeft'), last)).toBe('prev');
  });
});

describe('BB-HOME-10: Slide indexes clamp and the URL selects the starting slide', () => {
  it('clamps index math and reads ?stage plus the section hash', () => {
    expect(nextIndex(0, 7)).toBe(1);
    expect(nextIndex(6, 7)).toBe(6);
    expect(prevIndex(0)).toBe(0);
    expect(prevIndex(3)).toBe(2);
    expect(clampIndex(-3, 7)).toBe(0);
    expect(clampIndex(99, 7)).toBe(6);
    const ids = ['top', 'problem', 'views', 'curriculum'];
    expect(readStageFromUrl('?stage', '', ids)).toEqual({ active: true, index: 0 });
    expect(readStageFromUrl('?stage', '#curriculum', ids)).toEqual({ active: true, index: 3 });
    expect(readStageFromUrl('?stage=1&x=2', '#nope', ids)).toEqual({ active: true, index: 0 });
    expect(readStageFromUrl('', '#views', ids)).toEqual({ active: false, index: 2 });
    expect(readStageFromUrl('?stages', '', ids).active).toBe(false);
  });
});

describe('BB-HOME-11: Focused elements are classified for key handling', () => {
  it('recognises text fields, vertex handles, controls and everything else', () => {
    document.body.innerHTML =
      '<input id="i"><textarea id="t"></textarea><div id="ce" contenteditable="true"></div>' +
      '<a id="a" href="/x">x</a><button id="b">b</button>' +
      '<svg><g id="v" data-vertex-handle="" tabindex="0" role="button"></g></svg><p id="p">p</p>';
    const el = (id: string) => document.getElementById(id);
    expect(focusKind(null)).toBe('none');
    expect(focusKind(el('i'))).toBe('text');
    expect(focusKind(el('t'))).toBe('text');
    expect(focusKind(el('ce'))).toBe('text');
    expect(focusKind(el('a'))).toBe('interactive');
    expect(focusKind(el('b'))).toBe('interactive');
    expect(focusKind(el('v'))).toBe('vertex');
    expect(focusKind(el('p'))).toBe('none');
    expect(focusKind(document.body)).toBe('none');
    document.body.innerHTML = '';
  });
});

import { SECTIONS, PROBLEM, VIEWS, CURRICULUM, UNDER_THE_HOOD, TEAM, TRY_IT } from '@/pages/home/model/content';
import { COURSE } from '@/features/lesson-engine/model/catalog';
import { DEFAULT_SITE_URL, findRouteMeta } from '@/app/routes/route-meta';
import { buildHead } from '@/app/seo/head';

const BANNED = ['coming soon', 'not yet', 'future', 'deferred', 'unsupported', 'not supported', '3d', 'lighting'];

describe('BB-HOME-12: Home content is complete and follows the copy rules', () => {
  it('orders the seven sections, names the five curriculum sections and avoids banned words', () => {
    expect(SECTIONS.map((s) => s.id)).toEqual(['top', 'problem', 'views', 'curriculum', 'under-the-hood', 'team', 'try']);
    expect(COURSE.map((c) => c.section)).toEqual(['Pipeline', 'Primitives', 'Buffers', 'Transforms', 'Textures']);
    expect(DEFAULT_SITE_URL).toBe(`https://${TRY_IT.displayUrl}`);
    const text = JSON.stringify({ SECTIONS, PROBLEM, VIEWS, CURRICULUM, COURSE, UNDER_THE_HOOD, TEAM, TRY_IT }).toLowerCase();
    for (const word of BANNED) expect(text).not.toContain(word);
  });
});

describe('BB-HOME-13: The home page structured data credits the team', () => {
  it('lists the three members as authors and the adviser as contributor', () => {
    const elements = [...buildHead(findRouteMeta('/'), 'https://example.test').elements];
    const script = elements.find((e) => e.type === 'script' && e.props.type === 'application/ld+json');
    const jsonLd = JSON.parse(script!.props.children);
    expect(jsonLd.author).toEqual([
      { '@type': 'Person', name: 'Mikhael Edman P. Gomez' },
      { '@type': 'Person', name: 'Justine Jhigz D. Vizco' },
      { '@type': 'Person', name: 'Johann Patrick S. Taguiam' },
    ]);
    expect(jsonLd.contributor).toEqual({ '@type': 'Person', name: 'Elisa V. Malasaga' });
  });
});

import { h, render } from 'preact';
import VertexDemo from '@/pages/home/ui/VertexDemo';

async function settle() {
  for (let i = 0; i < 3; i++) await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('BB-HOME-14: Moving a vertex with the keyboard updates its label and code line', () => {
  it('steps by one grid unit, by four with Shift, and highlights the moved vertex line', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    render(h(VertexDemo, {}), host);
    await settle();
    const selectedLine = () => host.querySelector('.vertex-demo__line--selected')?.textContent;
    expect(selectedLine()).toBe('    glVertex2f(0.0000f, 0.5000f);');

    const handle = host.querySelectorAll('[data-vertex-handle]')[0];
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await settle();
    expect(handle.getAttribute('aria-label')).toBe('Vertex 1 at x -0.45, y -0.50');
    expect(selectedLine()).toBe('    glVertex2f(-0.4500f, -0.5000f);');

    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', shiftKey: true, bubbles: true }));
    await settle();
    expect(selectedLine()).toBe('    glVertex2f(-0.4500f, -0.3000f);');

    render(null, host);
    host.remove();
  });
});

import { prerender } from '@/app/prerender';

describe('BB-HOME-15: The prerendered home page carries every section of the talk', () => {
  it('renders the seven slides in order with the team, the stack line and the demo code', async () => {
    window.history.replaceState(null, '', '/');
    const { html } = await prerender({ url: '/' });
    const positions = SECTIONS.map((s) => html.indexOf(`id="${s.id}"`));
    for (const position of positions) expect(position).toBeGreaterThan(-1);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(html.match(/data-slide(?:="")?[\s>]/g)?.length).toBe(7);
    for (const member of TEAM.members) expect(html).toContain(member.name);
    for (const item of UNDER_THE_HOOD.stack) expect(html).toContain(`<li>${item}</li>`);
    // The demo colours each function name in its own span, so match the code line with tags removed.
    expect(html.replace(/<[^>]+>/g, '')).toContain('glVertex2f(0.0000f, 0.5000f);');
    const text = html
      .replace(/<script[\s\S]*?<\/script>/g, '')
      .replace(/<[^>]+>/g, ' ')
      .toLowerCase();
    for (const word of BANNED) expect(text).not.toContain(word);
  });
});

import { afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { LocationProvider } from 'preact-iso';
import HomePage from '@/pages/home';

function mountHome(url: string) {
  window.history.replaceState(null, '', url);
  const host = document.createElement('div');
  document.body.appendChild(host);
  render(h(LocationProvider, null, h(HomePage, null)), host);
  return host;
}

function press(key: string, init: KeyboardEventInit = {}) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init }));
}

function resetStage() {
  vi.unstubAllGlobals();
  document.documentElement.classList.remove('stage');
  window.history.replaceState(null, '', '/');
}

describe('BB-HOME-16: A stage URL opens on its slide and keys step and exit', () => {
  afterEach(resetStage);
  it('starts at the hashed slide, steps forward with PageDown and leaves on Escape', async () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const host = mountHome('/?stage#curriculum');
    await settle();
    const root = document.documentElement;
    const indicator = () => host.querySelector('.stage-indicator')?.textContent ?? null;
    expect(root.classList.contains('stage')).toBe(true);
    expect(indicator()).toContain('04 / 07');

    press('PageDown');
    await settle();
    expect(indicator()).toContain('05 / 07');
    expect(window.location.search).toBe('?stage');
    expect(window.location.hash).toBe('#under-the-hood');

    press('Escape');
    await settle();
    expect(root.classList.contains('stage')).toBe(false);
    expect(indicator()).toBeNull();
    expect(window.location.search).toBe('');

    render(null, host);
    host.remove();
  });
});

describe('BB-HOME-17: P enters stage mode and stepping past the end opens the editor', () => {
  afterEach(resetStage);
  it('enters from the scroll page, jumps to the last slide, routes to /app and cleans up on unmount', async () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const host = mountHome('/');
    await settle();
    const root = document.documentElement;
    expect(root.classList.contains('stage')).toBe(false);
    expect(host.querySelector('.present-button')).not.toBeNull();

    press('p');
    await settle();
    expect(root.classList.contains('stage')).toBe(true);
    expect(host.querySelector('.stage-indicator')?.textContent).toContain('01 / 07');

    press('End');
    await settle();
    expect(host.querySelector('.stage-indicator')?.textContent).toContain('07 / 07');

    press('PageDown');
    await settle();
    expect(window.location.pathname).toBe('/app');
    expect(window.location.search).toBe('?scene=triangle');

    render(null, host);
    host.remove();
    expect(root.classList.contains('stage')).toBe(false);
  });
});

describe('BB-HOME-18: The early inline script applies the stage layout before first paint', () => {
  afterEach(resetStage);
  it('adds the stage class only for / with a stage parameter', () => {
    const html = readFileSync('index.html', 'utf8');
    const body = html.match(/<script>([\s\S]*?)<\/script>/)![1];
    const root = document.documentElement;
    const run = (url: string) => {
      window.history.replaceState(null, '', url);
      root.className = '';
      new Function(body)();
      return root.classList;
    };
    expect(run('/?stage').contains('stage')).toBe(true);
    expect(run('/?stage#team').contains('stage')).toBe(true);
    expect(run('/').contains('stage')).toBe(false);
    expect(run('/?stages').contains('stage')).toBe(false);
    const app = run('/app?stage');
    expect(app.contains('stage')).toBe(false);
    expect(app.contains('route-editor')).toBe(true);
    root.className = '';
  });
});

describe('BB-HOME-19: Present starts at the first slide and tracking follows the visible slide', () => {
  afterEach(resetStage);
  it('starts at 01 from the footer, ignores slides passed or partly visible while stepping, then follows wheel scrolling', async () => {
    const observers: { callback: IntersectionObserverCallback; elements: Element[] }[] = [];
    class FakeIntersectionObserver {
      readonly elements: Element[] = [];
      constructor(callback: IntersectionObserverCallback) {
        observers.push({ callback, elements: this.elements });
      }
      observe(el: Element) {
        this.elements.push(el);
      }
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    }
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
    const host = mountHome('/');
    await settle();
    // The footer sits under the last slide, so that slide is the one nearest the viewport top.
    for (const section of host.querySelectorAll<HTMLElement>('[data-slide]')) {
      section.getBoundingClientRect = () => ({ top: section.id === 'try' ? 0 : 5000 }) as DOMRect;
    }
    const indicator = () => host.querySelector('.stage-indicator')?.textContent ?? null;
    const emit = (id: string, ratio: number) => {
      const observer = observers[observers.length - 1];
      const target = observer.elements.find((el) => el.id === id)!;
      const entry = { target, isIntersecting: ratio > 0, intersectionRatio: ratio } as unknown as IntersectionObserverEntry;
      observer.callback([entry], observer as unknown as IntersectionObserver);
    };

    expect(host.querySelector('.stage-live')?.textContent).toBe('');
    (host.querySelector('.present-button') as HTMLButtonElement).click();
    await settle();
    expect(indicator()).toContain('01 / 07');

    press('PageDown');
    await settle();
    expect(indicator()).toContain('02 / 07');

    // The slide being left is still partly visible.
    emit('top', 0.3);
    await settle();
    expect(indicator()).toContain('02 / 07');
    // A slide other than the target, reported while the stepped scroll is in flight.
    emit('curriculum', 0.9);
    await settle();
    expect(indicator()).toContain('02 / 07');

    // The target reports in, which ends the scroll window; then the presenter scrolls with the wheel.
    emit('problem', 1);
    emit('curriculum', 0.8);
    await settle();
    expect(indicator()).toContain('04 / 07');
    expect(window.location.hash).toBe('#curriculum');

    render(null, host);
    host.remove();
  });
});

describe('BB-HOME-20: Sections carry no eyebrows, sheet numbers or decorative separators', () => {
  it('renders headlines alone and keeps em dashes and middots out of visible copy', async () => {
    window.history.replaceState(null, '', '/');
    const { html } = await prerender({ url: '/' });
    expect(html).not.toContain('home-section__eyebrow');
    expect(html).not.toContain('home__eyebrow');
    expect(html).not.toContain('curriculum-list__number');
    const visible = html
      .replace(/<script[\s\S]*?<\/script>/g, '')
      .replace(/<head>[\s\S]*?<\/head>/, '')
      .replace(/<dl class="vertex-demo__math"[\s\S]*?<\/dl>/g, '')
      .replace(/<[^>]+>/g, ' ');
    expect(visible).not.toContain('—');
    expect(visible).not.toContain('·');
  });
});

describe('BB-HOME-21: The hero colours one word and the curriculum is a five-stop pipeline', () => {
  it('uses an accent span, not italics, and lists the five sections in order', async () => {
    window.history.replaceState(null, '', '/');
    const { html } = await prerender({ url: '/' });
    expect(html).toContain('<span class="home__accent">program.</span>');
    expect(html).not.toMatch(/<em>program\.<\/em>/);
    const names = [...html.matchAll(/<h3 class="pipeline__name">([^<]+)<\/h3>/g)].map((m) => m[1]);
    expect(names).toEqual(['Pipeline', 'Primitives', 'Buffers', 'Transforms', 'Textures']);
  });
});

describe('BB-HOME-22: The curriculum slide links to every lesson on /learn', () => {
  it('renders one /learn link inside the curriculum section', async () => {
    window.history.replaceState(null, '', '/');
    const { html } = await prerender({ url: '/' });
    const curriculum = html.slice(html.indexOf('id="curriculum"'), html.indexOf('id="under-the-hood"'));
    expect(curriculum).toContain('<a href="/learn">See every lesson</a>');
  });
});

describe('BB-HOME-23: The hero offers the lessons beside the app', () => {
  it('renders an outlined /learn button after Open the app', async () => {
    window.history.replaceState(null, '', '/');
    const { html } = await prerender({ url: '/' });
    const host = document.createElement('div');
    host.innerHTML = html;
    const actions = [...host.querySelectorAll('#top .home__actions a')];
    expect(actions.map((a) => a.getAttribute('href'))).toEqual(['/app', '/learn']);
    expect(actions[1].textContent).toBe('Browse the lessons');
    expect(actions[1].classList.contains('home__cta--secondary')).toBe(true);
  });
});

describe('BB-HOME-24: The Team slide links to the full story on /about', () => {
  it('renders one /about link inside the team section', async () => {
    window.history.replaceState(null, '', '/');
    const { html } = await prerender({ url: '/' });
    const team = html.slice(html.indexOf('id="team"'), html.indexOf('id="try"'));
    expect(team).toContain('<p class="team-more"><a href="/about">The full story</a></p>');
  });
});
