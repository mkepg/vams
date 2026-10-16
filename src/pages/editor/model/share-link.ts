import type { ShareLink } from '@/features/share';

/** Windows narrower than this get the read-only scene view: the editor's own minimum width. */
export const PHONE_MAX_WIDTH = 960;

export function parseShareLink(pathname: string, hash: string): ShareLink | null {
  const stored = /^\/s\/([^/]+)\/?$/.exec(pathname);
  if (stored) return { kind: 'stored', id: safeDecode(stored[1]) };
  const carried = /^#s=(.+)$/.exec(hash);
  return carried ? { kind: 'carried', data: carried[1] } : null;
}

interface LocationLike {
  pathname: string;
  search: string;
  hash: string;
}

export function shouldShowSceneView(width: number, loc: LocationLike): boolean {
  if (width >= PHONE_MAX_WIDTH) return false;
  if (new URLSearchParams(loc.search).has('editor')) return false;
  return parseShareLink(loc.pathname, loc.hash) !== null;
}

/** The same link, asking for the editor even on a narrow window. */
export function editorAnywayUrl(loc: LocationLike): string {
  const params = new URLSearchParams(loc.search);
  params.set('editor', '1');
  return `${loc.pathname}?${params.toString()}${loc.hash}`;
}

/** A malformed escape is kept as typed; it then fails the id check and is worded as a missing scene. */
function safeDecode(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}
