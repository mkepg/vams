/** The NAME="value" and NAME=${OTHER:-default} assignments of a shell script, expanded in order. */
export function shellVariables(script: string): Map<string, string> {
  const vars = new Map<string, string>();
  const expand = (s: string) =>
    s.replace(/\$\{(\w+)(?::-([^}]*))?\}|\$(\w+)/g, (_m, a: string, def: string | undefined, b: string) => {
      const name = a ?? b;
      return vars.get(name) ?? def ?? '';
    });
  for (const line of script.split(/\r?\n/)) {
    const m = /^([A-Z_][A-Z0-9_]*)=(?:"([^"]*)"|(\$\{[^}]*\}))\s*$/.exec(line);
    if (m) vars.set(m[1], expand(m[2] ?? m[3]));
  }
  return vars;
}
