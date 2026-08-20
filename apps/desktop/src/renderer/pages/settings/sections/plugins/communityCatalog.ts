/**
 * First-party community plugins. Same shape as Inkdrop: one git repo per
 * plugin, installed from its GitHub release tarball. Not a fake marketplace —
 * only list plugins that actually exist as public repos with a release.
 */

export interface CatalogPlugin {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  repository: string;
}

export const COMMUNITY_CATALOG: CatalogPlugin[] = [
  {
    id: 'stamp',
    name: 'Stamp',
    description: 'Insert the current date or timestamp at the cursor.',
    version: '0.1.0',
    author: 'Dripnex',
    repository: 'dripnex/plugin-stamp',
  },
  {
    id: 'dripnex-vim-mode',
    name: 'Vim Mode',
    description: 'Vim keybindings, Ex commands, relative line numbers, and clipboard yank.',
    version: '1.2.0',
    author: 'Dripnex',
    repository: 'dripnex/plugin-vim',
  },
];
