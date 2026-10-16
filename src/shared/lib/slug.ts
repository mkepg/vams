/** A file-name-safe form of a name: letters, digits, `_` and `-`, lower case, spaces as hyphens. Empty names become `vams-scene`. */
export function slugify(name: string): string {
  return (
    name
      .replace(/[^\w\- ]+/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .toLowerCase() || 'vams-scene'
  );
}
