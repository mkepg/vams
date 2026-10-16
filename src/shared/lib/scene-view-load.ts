/** What a shared link points at: a scene carried in the hash, or one stored on the server. */
export type ShareLink = { kind: 'carried'; data: string } | { kind: 'stored'; id: string };

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

/** True when this page load is the phone scene view: the store must then leave the visitor's saved data alone. */
export function isSceneViewLoad(): boolean {
  return typeof window !== 'undefined' && shouldShowSceneView(window.innerWidth, window.location);
}
