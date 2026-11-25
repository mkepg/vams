/**
 * The stylesheets a prerendered page needs before it paints. A route the site loads lazily, such
 * as /lab, is prerendered with its markup, but its CSS comes with its JavaScript chunk, after the
 * page has painted: until then the markup shows unstyled (the Lab's pixel wordmark filled the
 * window). The build links that CSS in the page's head, beside the main stylesheet.
 */

/** The prerendered pages of lazily loaded routes, and the module each route loads. */
export const LAZY_ROUTE_PAGES: Record<string, RegExp> = {
  'lab/index.html': /[\\/]src[\\/]pages[\\/]lab[\\/]index\.tsx?$/,
};

/** A chunk as the build sees it: the CSS it imports, and the chunks it imports statically. */
export interface CssChunk {
  fileName: string;
  facadeModuleId: string | null;
  imports: readonly string[];
  importedCss: Iterable<string>;
}

/** Every CSS file a chunk and the chunks it imports statically bring, in import order, once each. */
export function chunkCss(entry: CssChunk, chunks: ReadonlyMap<string, CssChunk>): string[] {
  const css: string[] = [];
  const seen = new Set<string>();
  const visit = (chunk: CssChunk) => {
    if (seen.has(chunk.fileName)) return;
    seen.add(chunk.fileName);
    for (const name of chunk.imports) {
      const imported = chunks.get(name);
      if (imported) visit(imported);
    }
    for (const file of chunk.importedCss) if (!css.includes(file)) css.push(file);
  };
  visit(entry);
  return css;
}

/**
 * The page with a stylesheet link for each file it doesn't already link, placed after its last
 * stylesheet (or at the end of its head).
 */
export function linkStylesheets(html: string, files: readonly string[], base = '/'): string {
  const missing = files.filter((file) => !html.includes(`href="${base}${file}"`));
  if (missing.length === 0) return html;
  const links = missing.map((file) => `<link rel="stylesheet" crossorigin href="${base}${file}">`).join('');
  const sheets = [...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/g)];
  const last = sheets.at(-1);
  if (last?.index !== undefined) {
    const at = last.index + last[0].length;
    return html.slice(0, at) + links + html.slice(at);
  }
  return html.replace('</head>', `${links}</head>`);
}
