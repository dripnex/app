import type { ListOptions } from '../../preload/index';
import type {
  NavigationState,
  StatusFilter,
  TagFilter,
  SortBy,
  SortOrder,
} from '../stores/navigationStore';

const LIST_LIMIT = 10000;
const TEMPLATES_NOTEBOOK_ID = 'templates';

export function listOptionsFromNav(input: {
  navigation: NavigationState;
  statusFilter: StatusFilter;
  tagFilter: TagFilter;
  sortBy?: SortBy;
  sortOrder?: SortOrder;
}): ListOptions {
  const options: ListOptions = {
    ...optionsForNavigation(input.navigation),
    limit: LIST_LIMIT,
  };

  if (input.statusFilter) {
    options.status = input.statusFilter;
  }

  const tag = resolveTag(input.navigation, input.tagFilter);
  if (tag) {
    options.tag = tag;
  }

  if (input.sortBy) {
    options.sortBy = input.sortBy;
  }
  if (input.sortOrder) {
    options.sortOrder = input.sortOrder;
  }

  return options;
}

function optionsForNavigation(navigation: NavigationState): ListOptions {
  switch (navigation.kind) {
    case 'global':
      if (navigation.filter === 'pinned') {
        return {
          archived: 'all',
          isPinned: true,
          isDeleted: false,
          excludeNotebookIds: [TEMPLATES_NOTEBOOK_ID],
        };
      }
      if (navigation.filter === 'trash') {
        return {
          archived: 'all',
          isDeleted: true,
        };
      }
      return globalAllOptions();

    case 'notebook':
      return {
        notebookId: navigation.id,
        archived: 'active',
        isDeleted: false,
      };

    case 'tag':
      return {
        archived: 'active',
        isDeleted: false,
      };

    case 'search':
      return globalAllOptions();
  }
}

function globalAllOptions(): ListOptions {
  return {
    archived: 'active',
    isDeleted: false,
    excludeNotebookIds: [TEMPLATES_NOTEBOOK_ID],
  };
}

function resolveTag(navigation: NavigationState, tagFilter: TagFilter): string | null {
  if (tagFilter) return tagFilter;
  return navigation.kind === 'tag' ? navigation.name : null;
}
