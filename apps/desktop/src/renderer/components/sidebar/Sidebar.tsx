import {
  useNavigation,
  useIsNotebookContext,
  useSelectedNotebookId,
  useGlobalFilter,
  useNavigationActions,
  useGlobalCounts,
  useDisplayedNotesCount,
  useStatusFilter,
} from '../../hooks/useNavigation';
import { SidebarBreadcrumb } from './SidebarBreadcrumb';
import { SidebarQuickFilters } from './SidebarQuickFilters';
import { SidebarSection } from './SidebarSection';
import { NotebookList } from './NotebookList';
import { TagsList } from './TagsList';
import { StatusFilters } from './StatusFilters';
import { SidebarFooter } from './SidebarFooter';

/**
 * Sidebar component - Pure render of NavigationState from Zustand
 *
 * Uses granular selectors to minimize re-renders.
 * Does NOT manage state - only renders UI and emits actions.
 */
export function Sidebar() {
  // Granular selectors
  const isNotebookContext = useIsNotebookContext();
  const selectedNotebookId = useSelectedNotebookId();
  const globalFilter = useGlobalFilter();
  const globalCounts = useGlobalCounts();
  const displayedNotesCount = useDisplayedNotesCount();
  const statusFilter = useStatusFilter();

  // Actions
  const {
    goToAllNotes,
    goToPinned,
    goToTrash,
    goToNotebook,
    goToTag,
    clearNavigation,
    setStatusFilter,
  } = useNavigationActions();

  return (
    <aside className="sidebar" aria-label="Main sidebar">
      <SidebarBreadcrumb
        selectedNotebookId={selectedNotebookId}
        onNavigate={(id) => (id ? goToNotebook(id) : clearNavigation())}
      />

      <SidebarQuickFilters
        allNotesCount={isNotebookContext ? displayedNotesCount : globalCounts.active}
        pinnedCount={globalCounts.pinned}
        trashCount={globalCounts.deleted}
        selectedFilter={globalFilter}
        onSelectFilter={(filter) => {
          if (filter === 'all') goToAllNotes();
          else if (filter === 'pinned') goToPinned();
          else if (filter === 'trash') goToTrash();
        }}
        isNotebookContext={isNotebookContext}
      />

      <SidebarSection
        title="Notebooks"
        collapsible
        onAdd={() => {
          // Notebook creation is handled inside NotebookList
        }}
      >
        <NotebookList
          selectedNotebookId={selectedNotebookId}
          onSelectNotebook={goToNotebook}
          filterParentId={isNotebookContext ? selectedNotebookId : undefined}
        />
      </SidebarSection>

      <SidebarSection title="Tags" collapsible defaultCollapsed>
        <TagsList onSelectTag={goToTag} />
      </SidebarSection>

      <SidebarSection title="Status" collapsible defaultCollapsed>
        <StatusFilters
          counts={globalCounts.byStatus}
          selectedStatus={statusFilter}
          onSelectStatus={setStatusFilter}
        />
      </SidebarSection>

      <SidebarFooter appVersion={window.readied.app.version()} />
    </aside>
  );
}
