import { describe, expect, it } from 'vitest';
import { listOptionsFromNav } from '../listOptionsFromNav';
import type { NavigationState } from '../../stores/navigationStore';

const ALL: NavigationState = { kind: 'global', filter: 'all' };
const PINNED: NavigationState = { kind: 'global', filter: 'pinned' };
const TRASH: NavigationState = { kind: 'global', filter: 'trash' };
const NOTEBOOK: NavigationState = { kind: 'notebook', id: 'inbox' };
const TAG: NavigationState = { kind: 'tag', name: 'work' };
const SEARCH: NavigationState = { kind: 'search', query: 'habit' };

describe('listOptionsFromNav', () => {
  describe('navigation kinds', () => {
    it('maps global/all to active, not deleted, excluding templates', () => {
      expect(
        listOptionsFromNav({
          navigation: ALL,
          statusFilter: null,
          tagFilter: null,
        })
      ).toEqual({
        archived: 'active',
        isDeleted: false,
        excludeNotebookIds: ['templates'],
        limit: 10000,
      });
    });

    it('maps global/pinned to pinned notes including archived, excluding templates', () => {
      expect(
        listOptionsFromNav({
          navigation: PINNED,
          statusFilter: null,
          tagFilter: null,
        })
      ).toEqual({
        archived: 'all',
        isPinned: true,
        isDeleted: false,
        excludeNotebookIds: ['templates'],
        limit: 10000,
      });
    });

    it('maps global/trash to deleted notes including archived', () => {
      expect(
        listOptionsFromNav({
          navigation: TRASH,
          statusFilter: null,
          tagFilter: null,
        })
      ).toEqual({
        archived: 'all',
        isDeleted: true,
        limit: 10000,
      });
    });

    it('does not exclude templates in trash', () => {
      const options = listOptionsFromNav({
        navigation: TRASH,
        statusFilter: null,
        tagFilter: null,
      });

      expect(options.excludeNotebookIds).toBeUndefined();
    });

    it('maps notebook to notebookId, active, not deleted', () => {
      expect(
        listOptionsFromNav({
          navigation: NOTEBOOK,
          statusFilter: null,
          tagFilter: null,
        })
      ).toEqual({
        notebookId: 'inbox',
        archived: 'active',
        isDeleted: false,
        limit: 10000,
      });
    });

    it('lists the workspace tree when All Notes is selected inside a workspace', () => {
      expect(
        listOptionsFromNav({
          navigation: { kind: 'notebook', id: 'work' },
          statusFilter: null,
          tagFilter: null,
          workspaceNotebookIds: ['work', 'api'],
          workspaceListAll: true,
        })
      ).toEqual({
        notebookIds: ['work', 'api'],
        archived: 'active',
        isDeleted: false,
        limit: 10000,
      });
    });

    it('scopes sidebar counts to the workspace tree', () => {
      expect(
        listOptionsFromNav({
          navigation: { kind: 'notebook', id: 'api' },
          statusFilter: null,
          tagFilter: null,
          workspaceNotebookIds: ['work', 'api'],
          scopeToWorkspaceTree: true,
        }).notebookIds
      ).toEqual(['work', 'api']);
    });

    it('maps tag kind to tag name, active, not deleted', () => {
      expect(
        listOptionsFromNav({
          navigation: TAG,
          statusFilter: null,
          tagFilter: null,
        })
      ).toEqual({
        tag: 'work',
        archived: 'active',
        isDeleted: false,
        limit: 10000,
      });
    });

    it('treats search like global/all, excluding templates', () => {
      expect(
        listOptionsFromNav({
          navigation: SEARCH,
          statusFilter: null,
          tagFilter: null,
        })
      ).toEqual({
        archived: 'active',
        isDeleted: false,
        excludeNotebookIds: ['templates'],
        limit: 10000,
      });
    });
  });

  describe('templates exclude', () => {
    it.each([
      ['global/all', ALL],
      ['global/pinned', PINNED],
      ['search', SEARCH],
    ] as const)('excludes templates for %s', (_label, navigation) => {
      const options = listOptionsFromNav({
        navigation,
        statusFilter: null,
        tagFilter: null,
      });

      expect(options.excludeNotebookIds).toEqual(['templates']);
    });

    it.each([
      ['global/trash', TRASH],
      ['notebook', NOTEBOOK],
      ['tag', TAG],
    ] as const)('does not exclude templates for %s', (_label, navigation) => {
      const options = listOptionsFromNav({
        navigation,
        statusFilter: null,
        tagFilter: null,
      });

      expect(options.excludeNotebookIds).toBeUndefined();
    });
  });

  describe('overlays', () => {
    it('overlays statusFilter onto any view', () => {
      expect(
        listOptionsFromNav({
          navigation: NOTEBOOK,
          statusFilter: 'on_hold',
          tagFilter: null,
        })
      ).toEqual({
        notebookId: 'inbox',
        archived: 'active',
        isDeleted: false,
        status: 'on_hold',
        limit: 10000,
      });
    });

    it('overlays tagFilter onto global/all', () => {
      expect(
        listOptionsFromNav({
          navigation: ALL,
          statusFilter: null,
          tagFilter: 'bug',
        })
      ).toEqual({
        archived: 'active',
        isDeleted: false,
        excludeNotebookIds: ['templates'],
        tag: 'bug',
        limit: 10000,
      });
    });

    it('lets tagFilter win over navigation tag', () => {
      expect(
        listOptionsFromNav({
          navigation: TAG,
          statusFilter: null,
          tagFilter: 'personal',
        }).tag
      ).toBe('personal');
    });

    it('uses navigation tag when tagFilter is not set', () => {
      expect(
        listOptionsFromNav({
          navigation: TAG,
          statusFilter: null,
          tagFilter: null,
        }).tag
      ).toBe('work');
    });

    it('applies status and tag overlays together', () => {
      expect(
        listOptionsFromNav({
          navigation: ALL,
          statusFilter: 'completed',
          tagFilter: 'ship',
        })
      ).toMatchObject({
        status: 'completed',
        tag: 'ship',
        archived: 'active',
        isDeleted: false,
        excludeNotebookIds: ['templates'],
        limit: 10000,
      });
    });

    it('overlays filters onto trash without changing delete/archive flags', () => {
      expect(
        listOptionsFromNav({
          navigation: TRASH,
          statusFilter: 'dropped',
          tagFilter: 'old',
        })
      ).toEqual({
        archived: 'all',
        isDeleted: true,
        status: 'dropped',
        tag: 'old',
        limit: 10000,
      });
    });
  });

  describe('sort and limit', () => {
    it('passes sortBy and sortOrder through', () => {
      expect(
        listOptionsFromNav({
          navigation: ALL,
          statusFilter: null,
          tagFilter: null,
          sortBy: 'title',
          sortOrder: 'asc',
        })
      ).toMatchObject({
        sortBy: 'title',
        sortOrder: 'asc',
      });
    });

    it('omits sort fields when not provided', () => {
      const options = listOptionsFromNav({
        navigation: ALL,
        statusFilter: null,
        tagFilter: null,
      });

      expect(options.sortBy).toBeUndefined();
      expect(options.sortOrder).toBeUndefined();
    });

    it('always sets limit to 10000', () => {
      const kinds: NavigationState[] = [ALL, PINNED, TRASH, NOTEBOOK, TAG, SEARCH];

      for (const navigation of kinds) {
        expect(
          listOptionsFromNav({
            navigation,
            statusFilter: null,
            tagFilter: null,
          }).limit
        ).toBe(10000);
      }
    });
  });
});
