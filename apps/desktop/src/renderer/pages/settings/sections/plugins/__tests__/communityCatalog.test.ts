import { describe, expect, it } from 'vitest';
import { COMMUNITY_CATALOG, installSpecFor, mergeFallbackCatalog } from '../communityCatalog';

describe('installSpecFor', () => {
  it('uses the GitHub repo, not the manifest id', () => {
    const vim = COMMUNITY_CATALOG.find(p => p.id === 'dripnex-vim-mode');
    expect(vim?.repository).toBe('dripnex/plugin-vim');
    expect(installSpecFor({ slug: vim!.id, repository: vim!.repository })).toBe(
      'dripnex/plugin-vim'
    );
  });

  it('falls back to the slug when there is no repository', () => {
    expect(installSpecFor({ slug: 'stamp', repository: null })).toBe('stamp');
  });
});

describe('mergeFallbackCatalog', () => {
  it('keeps vim when the live registry omitted it', () => {
    const merged = mergeFallbackCatalog([
      {
        slug: 'stamp',
        name: 'Stamp',
        description: '',
        version: '0.1.0',
        author: 'Dripnex',
        repository: 'dripnex/plugin-stamp',
      },
    ]);
    expect(merged.map(p => p.slug)).toContain('dripnex-vim-mode');
    expect(merged.find(p => p.slug === 'dripnex-vim-mode')?.repository).toBe('dripnex/plugin-vim');
  });

  it('does not duplicate a pack the registry already listed', () => {
    const merged = mergeFallbackCatalog([
      {
        slug: 'dripnex-vim-mode',
        name: 'Vim Mode',
        description: '',
        version: '1.2.0',
        author: 'Dripnex',
        repository: 'dripnex/plugin-vim',
      },
    ]);
    expect(merged.filter(p => p.slug === 'dripnex-vim-mode')).toHaveLength(1);
  });
});
