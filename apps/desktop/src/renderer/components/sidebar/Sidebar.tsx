import { useState, useCallback } from 'react';
import {
  useIsNotebookContext,
  useSelectedNotebookId,
  useGlobalFilter,
  useNavigationActions,
  useGlobalCounts,
  useDisplayedNotesCount,
  useStatusFilter,
  useTagFilter,
} from '../../hooks/useNavigation';
import { useNotebookMutations } from '../../hooks/useNotebooks';
import { SidebarHeader } from './SidebarHeader';
import { SidebarBreadcrumb } from './SidebarBreadcrumb';
import { SidebarQuickFilters } from './SidebarQuickFilters';
import { SidebarSection } from './SidebarSection';
import { NotebookList } from './NotebookList';
import { TagsList } from './TagsList';
import { StatusFilters } from './StatusFilters';
import { SidebarFooter } from './SidebarFooter';
import { NotebookCreateModal } from './NotebookCreateModal';

interface SidebarProps {
  onOpenGraph?: () => void;
}

/**
 * Sidebar component - Pure render of NavigationState from Zustand
 *
 * Uses granular selectors to minimize re-renders.
 * Owns modal state for notebook creation.
 */
export function Sidebar({ onOpenGraph }: SidebarProps) {
  // Modal state - lives HERE, not in NotebookList
  const [isCreateNotebookOpen, setIsCreateNotebookOpen] = useState(false);
  const [createParentId, setCreateParentId] = useState<string | null>(null);

  // Granular selectors
  const isNotebookContext = useIsNotebookContext();
  const selectedNotebookId = useSelectedNotebookId();
  const globalFilter = useGlobalFilter();
  const globalCounts = useGlobalCounts();
  const displayedNotesCount = useDisplayedNotesCount();
  const statusFilter = useStatusFilter();
  const tagFilter = useTagFilter();

  // Mutations
  const { createNotebook } = useNotebookMutations();

  // Navigation actions
  const {
    goToAllInCurrentContext,
    goToPinned,
    goToTrash,
    goToNotebook,
    clearNavigation,
    setStatusFilter,
    setTagFilter,
  } = useNavigationActions();

  // Modal handlers
  // When in notebook context, create child of current notebook
  // When at root level, create at root
  const openCreateInContext = useCallback(() => {
    setCreateParentId(selectedNotebookId);
    setIsCreateNotebookOpen(true);
  }, [selectedNotebookId]);

  const openCreateChild = useCallback((parentId: string) => {
    setCreateParentId(parentId);
    setIsCreateNotebookOpen(true);
  }, []);

  const closeCreate = useCallback(() => {
    setIsCreateNotebookOpen(false);
    setCreateParentId(null);
  }, []);

  const handleCreateNotebook = useCallback(
    async (name: string, parentId: string | null) => {
      await createNotebook.mutateAsync({
        name,
        parentId: parentId ?? undefined,
      });
      closeCreate();
    },
    [createNotebook, closeCreate]
  );

  return (
    <aside className="sidebar" aria-label="Main sidebar">
      <SidebarHeader onSettingsClick={() => window.readied.windows.openSettings()} />
      <SidebarBreadcrumb
        selectedNotebookId={selectedNotebookId}
        tagFilter={tagFilter}
        onNavigate={id => (id ? goToNotebook(id) : clearNavigation())}
        onClearTagFilter={() => setTagFilter(null)}
      />

      <SidebarQuickFilters
        allNotesCount={isNotebookContext ? displayedNotesCount : globalCounts.active}
        pinnedCount={globalCounts.pinned}
        trashCount={globalCounts.deleted}
        selectedFilter={globalFilter}
        onSelectFilter={filter => {
          if (filter === 'all') goToAllInCurrentContext();
          else if (filter === 'pinned') goToPinned();
          else if (filter === 'trash') goToTrash();
        }}
        isNotebookContext={isNotebookContext}
        onOpenGraph={onOpenGraph}
      />

      <SidebarSection title="Notebooks" collapsible onAdd={openCreateInContext}>
        <NotebookList
          selectedNotebookId={selectedNotebookId}
          onSelectNotebook={goToNotebook}
          filterParentId={isNotebookContext ? selectedNotebookId : undefined}
          onRequestCreateChild={openCreateChild}
        />
      </SidebarSection>

      <SidebarSection title="Tags" collapsible defaultCollapsed>
        <TagsList selectedTag={tagFilter} onSelectTag={setTagFilter} />
      </SidebarSection>

      <SidebarSection title="Status" collapsible defaultCollapsed>
        <StatusFilters
          counts={globalCounts.byStatus}
          selectedStatus={statusFilter}
          onSelectStatus={setStatusFilter}
        />
      </SidebarSection>

      <SidebarFooter appVersion={window.readied.app.version()} />

      {/* Modal - rendered at Sidebar level, NOT inside NotebookList */}
      {isCreateNotebookOpen && (
        <NotebookCreateModal
          parentId={createParentId}
          onSubmit={handleCreateNotebook}
          onCancel={closeCreate}
        />
      )}
    </aside>
  );
}
