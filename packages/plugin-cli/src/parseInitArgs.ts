export interface InitArgs {
  name: string;
  type: 'plugin' | 'theme';
}

/** Parse `dripnex-plugin init <name> [--type plugin|theme]`. */
export function parseInitArgs(rest: string[]): InitArgs {
  let type: 'plugin' | 'theme' = 'plugin';
  const nameParts: string[] = [];
  for (let i = 0; i < rest.length; i += 1) {
    const part = rest[i];
    if (part === '--type') {
      const next = rest[i + 1];
      if (next !== 'theme' && next !== 'plugin') {
        throw new Error('--type must be plugin or theme');
      }
      type = next;
      i += 1;
      continue;
    }
    if (part) nameParts.push(part);
  }
  return { name: nameParts.join(' ').trim(), type };
}
