import { SITE_NAME, type RouteMeta } from '../routes/route-meta';
import { TEAM } from '../../pages/home/model/content';

export interface HeadElement {
  type: 'meta' | 'link' | 'script';
  props: Record<string, string>;
}

export interface PageHead {
  lang: string;
  title: string;
  elements: Set<HeadElement>;
}

export const OG_IMAGE_PATH = '/og/og-default.png';

export function absoluteUrl(siteUrl: string, path: string): string {
  const base = siteUrl.endsWith('/') ? siteUrl : `${siteUrl}/`;
  return new URL(path.replace(/^\//, ''), base).toString();
}

export function softwareApplicationJsonLd(siteUrl: string) {
  const person = (name: string) => ({ '@type': 'Person', name });
  const adviser = TEAM.members.find((member) => member.role === 'adviser');
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: SITE_NAME,
    alternateName: 'Visual Animation Modeling Simulator',
    applicationCategory: 'EducationalApplication',
    operatingSystem: 'Web',
    url: absoluteUrl(siteUrl, '/'),
    description:
      'A GUI-only teaching simulator for OpenGL 1.5: build 2D scenes by hand and read the generated C++ code and the math behind it.',
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    author: TEAM.members.filter((member) => member.role === 'member').map((member) => person(member.name)),
    ...(adviser ? { contributor: person(adviser.name) } : {}),
  };
}

export function buildHead(meta: RouteMeta, siteUrl: string): PageHead {
  const pageUrl = absoluteUrl(siteUrl, meta.path);
  const elements = new Set<HeadElement>([
    { type: 'meta', props: { name: 'description', content: meta.description } },
    { type: 'meta', props: { property: 'og:type', content: 'website' } },
    { type: 'meta', props: { property: 'og:site_name', content: SITE_NAME } },
    { type: 'meta', props: { property: 'og:title', content: meta.title } },
    { type: 'meta', props: { property: 'og:description', content: meta.description } },
    { type: 'meta', props: { property: 'og:image', content: absoluteUrl(siteUrl, OG_IMAGE_PATH) } },
    { type: 'meta', props: { name: 'twitter:card', content: 'summary_large_image' } },
  ]);

  if (meta.indexable) {
    elements.add({ type: 'link', props: { rel: 'canonical', href: pageUrl } });
    elements.add({ type: 'meta', props: { property: 'og:url', content: pageUrl } });
  } else {
    elements.add({ type: 'meta', props: { name: 'robots', content: 'noindex' } });
  }

  if (meta.path === '/') {
    elements.add({
      type: 'script',
      props: { type: 'application/ld+json', children: JSON.stringify(softwareApplicationJsonLd(siteUrl)) },
    });
  }

  return { lang: 'en', title: meta.title, elements };
}
