/** Resolve one or more CSS-module class names. Falsy values are skipped. */
export function cssm(styles: Record<string, string>) {
  return (...names: Array<string | false | null | undefined>): string =>
    names.flatMap(name => (name && styles[name] ? [styles[name]] : [])).join(' ');
}
