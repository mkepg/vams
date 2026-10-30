/**
 * BLACK-BOX TEST SUITE — BB-GALLERY
 * The example gallery: its finished scenes, the links that open them, and the /gallery page.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { sanitizeProjectData } from '@/entities/project/model/project-io';
import { GALLERY_SCENES, galleryHref, galleryImage } from '@/entities/project/model/gallery-links';
import { PRESET_LINKS } from '@/entities/project/model/preset-links';
import { getPreset, isPresetSlug } from '@/entities/project/model/scene-presets';
import { clampAction, RULE_KINDS } from '@/core/callbacks/callbacks-model';
import { SAMPLE_TEXTURE_SPECS } from '@/features/textures/lib/sample-textures';
import { generateCodeFromState } from '@/features/code-generation/model/generate-from-state';
import { parseEditorLink } from '@/pages/editor/model/editor-link';
import { h, render } from 'preact';
import { renderToString } from 'preact-render-to-string';
import { prerender } from '@/app/prerender';
import { findRouteMeta } from '@/app/routes/route-meta';
import { buildSitemap } from '@/app/seo/sitemap';
import { NAV_LINKS } from '@/widgets/site-header/model/nav';
import SiteFooter from '@/widgets/site-footer';
import TryItSection from '@/pages/home/ui/sections/TryItSection';

const SECTIONS = ['Pipeline', 'Primitives', 'Buffers', 'Transforms', 'Textures'];
const SAMPLE_IDS = new Set<string>(SAMPLE_TEXTURE_SPECS.map((s) => s.id));
/** Stand-ins for the canvas-drawn samples, which happy-dom cannot paint. */
const SAMPLES = SAMPLE_TEXTURE_SPECS.map((s) => ({ ...s, dataUrl: 'data:image/png;base64,AA', isSample: true }));
/** Product plan Appendix C: never emitted. */
const DEFERRED = /\b(gluPerspective|glFrustum|glLight\w*|glMaterial\w*|glNormal\w*|GL_LIGHTING|GL_NORMALIZE)\b/;

function program(slug: string): string {
  const data = getPreset(slug)!.data;
  return generateCodeFromState(
    {
      objects: data.objects,
      canvasBackgroundColor: data.canvasBackgroundColor,
      callbacks: data.callbacks,
      viewportLimits: data.viewportLimits,
      textures: [...data.uploadedTextures, ...SAMPLES],
    },
    { width: 1280, height: 720 },
  );
}

describe('BB-GALLERY-01: The gallery lists five scenes, jeepney street first', () => {
  it('has the agreed slugs, titles and sections, distinct from the starter scenes', () => {
    expect(GALLERY_SCENES.map((s) => s.slug)).toEqual(['jeepney-street', 'solar-system', 'parol', 'clock', 'pixel-fox']);
    expect(GALLERY_SCENES.map((s) => s.title)).toEqual(['Jeepney street', 'Solar system', 'Parol at night', 'Analogue clock', 'Fox in the clouds']);
    expect(GALLERY_SCENES.map((s) => getPreset(s.slug)?.section)).toEqual(['Primitives', 'Transforms', 'Primitives', 'Transforms', 'Textures']);
    for (const scene of GALLERY_SCENES) {
      expect(scene.shows.length).toBeGreaterThan(0);
      for (const section of scene.shows) expect(SECTIONS).toContain(section);
      expect(PRESET_LINKS.some((p) => p.slug === scene.slug)).toBe(false);
    }
    expect(PRESET_LINKS.map((p) => p.slug)).toEqual(['triangle', 'transforms', 'primitives', 'textured-quad']);
  });
});

describe('BB-GALLERY-02: Every gallery scene passes the project validator unchanged', () => {
  it('keeps every object, rule and texture through a save and load', () => {
    for (const { slug } of GALLERY_SCENES) {
      const data = getPreset(slug)!.data;
      expect(sanitizeProjectData(JSON.parse(JSON.stringify(data))), slug).toEqual(data);
      expect(data.objects.length, slug).toBeGreaterThan(1);
      expect(data.viewportLimits).toEqual({ minX: -1.6, maxX: 1.6, minY: -0.9, maxY: 0.9 });
      const ids = new Set(data.objects.map((o) => o.id));
      expect(ids.size, `${slug}: unique ids`).toBe(data.objects.length);
      for (const o of data.objects) {
        for (const child of o.children ?? []) expect(ids.has(child), `${slug}: ${o.id} → ${child}`).toBe(true);
        if (o.texture) {
          const known = SAMPLE_IDS.has(o.texture.textureId) || data.uploadedTextures.some((t) => t.id === o.texture!.textureId);
          expect(known, `${slug}: ${o.id} texture`).toBe(true);
        }
      }
    }
  });
});

describe('BB-GALLERY-03: Gallery rules run and stay editable', () => {
  it('has rules in Run, each on a real object and already within its field’s range and precision', () => {
    for (const { slug } of GALLERY_SCENES) {
      const { objects, callbacks } = getPreset(slug)!.data;
      const ids = new Set(objects.map((o) => o.id));
      const rules = RULE_KINDS.flatMap((k) => callbacks[k].rules);
      expect(rules.length, slug).toBeGreaterThan(0);
      for (const r of rules) {
        expect(ids.has(r.objectId), `${slug}: ${r.id}`).toBe(true);
        expect(clampAction(r.action), `${slug}: ${r.id}`).toEqual(r.action);
      }
      for (const k of RULE_KINDS) {
        if (callbacks[k].rules.length > 0) expect(callbacks[k].handlerName, `${slug}: ${k}`).not.toBe('');
      }
    }
  });
});

describe('BB-GALLERY-04: Gallery scenes generate a whole program and nothing deferred', () => {
  it('registers each scene’s callbacks and uses the calls the scene is chosen to show', () => {
    const code = Object.fromEntries(GALLERY_SCENES.map((s) => [s.slug, program(s.slug)]));
    for (const [slug, text] of Object.entries(code)) {
      expect(text, slug).not.toMatch(DEFERRED);
      expect((text.match(/\{/g) ?? []).length, `${slug}: braces`).toBe((text.match(/\}/g) ?? []).length);
      expect(text, slug).toMatch(/\bint\s+main\s*\(/);
    }
    for (const slug of ['jeepney-street', 'solar-system', 'clock']) expect(code[slug]).toContain('glutIdleFunc(');
    expect(code['jeepney-street']).toContain('glutKeyboardFunc(onKey)');
    expect(code['jeepney-street']).toContain('glutBitmapCharacter');
    expect(code['jeepney-street']).toContain('glBindTexture');
    expect(code['solar-system']).toContain('glPushMatrix');
    expect(code['solar-system']).toContain('glBindBuffer');
    expect(code['parol']).toContain('glutMouseFunc(onMouse)');
    expect(code['parol']).toContain('GL_LINE_LOOP');
    expect(code['clock']).toContain('glRotatef');
    expect(code['pixel-fox']).toContain('glutSpecialFunc(onSpecial)');
    expect(code['pixel-fox']).toContain('glutReshapeFunc(onReshape)');
    expect(code['pixel-fox']).toContain('GL_REPEAT');
  });
});

describe('BB-GALLERY-05: A scene link opens each gallery scene', () => {
  it('accepts every gallery slug and still rejects unknown ones', () => {
    for (const { slug } of GALLERY_SCENES) {
      expect(isPresetSlug(slug)).toBe(true);
      expect(galleryHref(slug)).toBe(`/app?scene=${slug}`);
      expect(parseEditorLink(`?scene=${slug}`)).toEqual({ kind: 'scene', slug });
    }
    expect(parseEditorLink('?scene=gallery')).toEqual({ kind: 'invalid', param: 'scene', value: 'gallery' });
  });
});

describe('BB-GALLERY-06: Every gallery scene has its image', () => {
  it('serves a PNG still per scene from public/gallery', () => {
    for (const { slug, alt } of GALLERY_SCENES) {
      expect(galleryImage(slug)).toBe(`/gallery/${slug}.png`);
      expect(existsSync(`public/gallery/${slug}.png`), slug).toBe(true);
      expect(alt.length, slug).toBeGreaterThan(20);
    }
  });
});

async function prerenderAt(url: string) {
  window.history.replaceState(null, '', url);
  return prerender({ url });
}

describe('BB-GALLERY-07: /gallery is a finished, linked, prerendered page', () => {
  it('has indexable metadata, a header and footer link, a sitemap entry and a prerender entry', async () => {
    const meta = findRouteMeta('/gallery');
    expect(meta.path).toBe('/gallery');
    expect(meta.indexable).toBe(true);
    expect(meta.title).toBe('Gallery — VAMS');
    expect(NAV_LINKS.map((l) => l.href)).toEqual(['/', '/learn', '/gallery', '/guide', '/about']);
    expect(buildSitemap('https://example.test')).toContain('<loc>https://example.test/gallery/</loc>');
    expect(readFileSync('vite.config.ts', 'utf8')).toMatch(/additionalPrerenderRoutes:\s*\[[^\]]*'\/gallery'/);

    const host = document.createElement('div');
    render(h(SiteFooter, {}), host);
    expect(host.querySelector('.site-footer__links a[href="/gallery"]')?.textContent).toBe('Gallery');
    render(null, host);
  });
});

describe('BB-GALLERY-08: The page shows a card per scene, the jeepney street first and wide', () => {
  it('prerenders each card with its image, alt text, sections, Run hint and editor link', async () => {
    const result = await prerenderAt('/gallery');
    expect(result.head.title).toBe('Gallery — VAMS');
    const host = document.createElement('div');
    host.innerHTML = result.html;
    expect(host.querySelector('h1')?.textContent).toBe('Gallery');
    expect(host.querySelector('.site-header__link[aria-current="page"]')?.getAttribute('href')).toBe('/gallery');
    const cards = [...host.querySelectorAll('.gallery-card')];
    expect(cards.map((c) => c.querySelector('h2')?.textContent)).toEqual(GALLERY_SCENES.map((s) => s.title));
    expect(cards[0].classList.contains('gallery-card--lead')).toBe(true);
    expect(cards.slice(1).some((c) => c.classList.contains('gallery-card--lead'))).toBe(false);
    GALLERY_SCENES.forEach((scene, i) => {
      const card = cards[i];
      const img = card.querySelector('img')!;
      expect(img.getAttribute('src')).toBe(galleryImage(scene.slug));
      expect(img.getAttribute('alt')).toBe(scene.alt);
      const links = [...card.querySelectorAll('a')];
      expect(links).toHaveLength(1);
      expect(links[0].getAttribute('href')).toBe(galleryHref(scene.slug));
      expect(links[0].textContent).toBe('Open in the editor');
      // Read as "Open in the editor, <title>", so the five links are told apart in a links list.
      expect(links[0].getAttribute('aria-labelledby')).toBe(`${links[0].id} ${card.querySelector('h2')!.id}`);
      expect([...card.querySelectorAll('.gallery-card__shows li')].map((li) => li.textContent)).toEqual([...scene.shows]);
      expect(card.querySelector('.gallery-card__run')?.textContent).toContain(scene.run);
    });
  });
});

describe('BB-GALLERY-09: Slide 07 leads on to the gallery', () => {
  it('keeps the starting points and adds a gallery link after them', () => {
    const html = renderToString(h(TryItSection, null));
    const host = document.createElement('div');
    host.innerHTML = html;
    const links = [...host.querySelectorAll('.try-presets a')].map((a) => a.getAttribute('href'));
    expect(links).toEqual([...PRESET_LINKS.map((p) => `/app?scene=${p.slug}`), '/gallery']);
  });
});

describe('BB-GALLERY-10: Gallery copy stays silent about gaps', () => {
  it('uses none of the words the product rules keep out of student-facing text', () => {
    const text = JSON.stringify(GALLERY_SCENES) + readFileSync('src/pages/gallery/model/copy.ts', 'utf8');
    expect(text).not.toMatch(/coming soon|not supported|future|deferred|\b3D\b|lighting/i);
    expect(text).not.toMatch(/\bcolor\b/);
  });
});
