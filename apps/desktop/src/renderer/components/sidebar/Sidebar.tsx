import { useState, useCallback, useEffect, useRef } from 'react';
import { LayoutZone } from '@dripnex/plugin-api';
import { FileStack, Trash2 } from 'lucide-react';
import { DEFAULT_TEMPLATES } from '../../data/defaultTemplates';
import { useQueryClient } from '@tanstack/react-query';
import { useNoteMutations, useNotebookNotesCount } from '../../hooks/useNotes';
import { notebookKeys, useNotebookMutations } from '../../hooks/useNotebooks';
import {
  useIsNotebookContext,
  useSelectedNotebookId,
  useGlobalFilter,
  useNavigationActions,
  useGlobalCounts,
  useStatusFilter,
  useTagFilter,
  useScopedSidebarCounts,
  useNotebookContext,
} from '../../hooks/useNavigation';
import { EnableSyncModal } from '../sync';
import { useSyncOnboarding } from '../../hooks/useSyncOnboarding';
import { SidebarHeader } from './SidebarHeader';
import { SidebarBreadcrumb } from './SidebarBreadcrumb';
import { SidebarQuickFilters } from './SidebarQuickFilters';
import { SidebarSection } from './SidebarSection';
import { NotebookList } from './NotebookList';
import { TagsList } from './TagsList';
import { StatusFilters } from './StatusFilters';
import { SidebarFooter } from './SidebarFooter';
import { NotebookCreateModal } from './NotebookCreateModal';
import { sc } from './sc';

interface SidebarProps {
  onOpenGraph?: () => void;
}

export function Sidebar({ onOpenGraph }: SidebarProps) {
  const [appVersion, setAppVersion] = useState('');
  useEffect(() => {
    const result = window.dripnex.app.version();
    void Promise.resolve(result).then(setAppVersion);
  }, []);

  const [isCreateNotebookOpen, setIsCreateNotebookOpen] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const { shouldShowPrompt, dismissPrompt } = useSyncOnboarding();
  const [createParentId, setCreateParentId] = useState<string | null>(null);
  const [notebookQuery, setNotebookQuery] = useState('');
  const [tagQuery, setTagQuery] = useState('');

  const isNotebookContext = useIsNotebookContext();
  const selectedNotebookId = useSelectedNotebookId();
  const globalFilter = useGlobalFilter();
  const globalCounts = useGlobalCounts();
  const scoped = useScopedSidebarCounts();
  const notebookContext = useNotebookContext();
  const statusFilter = useStatusFilter();
  const tagFilter = useTagFilter();

  const queryClient = useQueryClient();
  const { createNotebook } = useNotebookMutations();
  const { createNote } = useNoteMutations();
  const templateCount = useNotebookNotesCount('templates');
  const {
    goToAllInCurrentContext,
    goToTrash,
    goToNotebook,
    clearNavigation,
    setStatusFilter,
    setTagFilter,
  } = useNavigationActions();

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

  const openTemplates = useCallback(async () => {
    if (!window.dripnex?.notebooks || !window.dripnex.notes) return;
    const ensure = window.dripnex.notebooks.ensureTemplates;
    if (typeof ensure === 'function') {
      await ensure();
    } else {
      console.warn(
        '[dripnex] notebooks.ensureTemplates is missing — restart Electron to reload preload'
      );
    }
    void queryClient.invalidateQueries({ queryKey: notebookKeys.all });
    const existing = await window.dripnex.notes.list({
      notebookId: 'templates',
      archived: 'active',
      isDeleted: false,
      limit: 100,
    });
    const have = new Set(existing.map(note => note.title.trim().toLowerCase()));
    for (const template of DEFAULT_TEMPLATES) {
      if (have.has(template.title.toLowerCase())) continue;
      await createNote.mutateAsync({ content: template.content, notebookId: 'templates' });
    }
    goToNotebook('templates');
  }, [createNote, goToNotebook, queryClient]);

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

  const inTrash = globalFilter === 'trash';
  const allNotesSelected = !inTrash && !statusFilter && !tagFilter;
  const showChildNotebooks = isNotebookContext && notebookContext.childrenIds.length > 0;
  const showNotebooks = !isNotebookContext || showChildNotebooks;
  const showTrash = !isNotebookContext;

  const prevNotebookId = useRef<string | null>(selectedNotebookId);
  const [paneDirection, setPaneDirection] = useState<'in' | 'out'>('in');
  useEffect(() => {
    const prev = prevNotebookId.current;
    const next = selectedNotebookId;
    if (prev === next) return;
    if (!prev && next) setPaneDirection('in');
    else if (prev && !next) setPaneDirection('out');
    else {
      const prevDepth = notebookContext.path.findIndex(p => p.id === prev);
      const nextDepth = notebookContext.path.findIndex(p => p.id === next);
      setPaneDirection(nextDepth >= prevDepth ? 'in' : 'out');
    }
    prevNotebookId.current = next;
  }, [selectedNotebookId, notebookContext.path]);

  return (
    <aside className={sc('sidebar')} aria-label="Main sidebar">
      <SidebarHeader
        onSettingsClick={() => window.dripnex.windows.openSettings()}
        onOpenGraph={onOpenGraph}
      />
      <SidebarBreadcrumb
        selectedNotebookId={selectedNotebookId}
        tagFilter={tagFilter}
        onNavigate={id => (id ? goToNotebook(id) : clearNavigation())}
        onClearTagFilter={() => setTagFilter(null)}
      />

      <div
        className={sc('sidebar-content', 'sidebar-pane', `sidebar-pane--${paneDirection}`)}
        key={selectedNotebookId ?? 'root'}
      >
        <SidebarQuickFilters
          allNotesCount={scoped.all}
          allNotesSelected={allNotesSelected}
          onSelectAll={goToAllInCurrentContext}
        />

        {!isNotebookContext && (
          <div className={sc('sidebar-templates')}>
            <button
              type="button"
              className={sc('sidebar-row', selectedNotebookId === 'templates' && 'selected')}
              onClick={() => void openTemplates()}
            >
              <span className={sc('sidebar-row-icon')} aria-hidden="true">
                <FileStack size={15} />
              </span>
              <span className={sc('sidebar-row-label')}>Note Templates</span>
              {templateCount > 0 ? <span className={sc('sidebar-row-count')}>{templateCount}</span> : null}
            </button>
          </div>
        )}

        {showNotebooks && (
          <SidebarSection
            title="Notebooks"
            collapsible
            onAdd={openCreateInContext}
            addLabel="New notebook"
            searchable
            searchQuery={notebookQuery}
            onSearchChange={setNotebookQuery}
            searchPlaceholder="Filter notebooks"
          >
            <NotebookList
              selectedNotebookId={selectedNotebookId}
              onSelectNotebook={goToNotebook}
              filterParentId={isNotebookContext ? selectedNotebookId : undefined}
              onRequestCreateChild={openCreateChild}
              nameFilter={notebookQuery}
            />
          </SidebarSection>
        )}

        <SidebarSection title="Status" collapsible>
          <StatusFilters
            counts={scoped.byStatus}
            selectedStatus={statusFilter}
            onSelectStatus={setStatusFilter}
          />
        </SidebarSection>

        <SidebarSection
          title="Tags"
          collapsible
          searchable
          searchQuery={tagQuery}
          onSearchChange={setTagQuery}
          searchPlaceholder="Filter tags"
        >
          <TagsList
            selectedTag={tagFilter}
            onSelectTag={setTagFilter}
            counts={scoped.byTag}
            filterQuery={tagQuery}
          />
        </SidebarSection>

        <LayoutZone name="sidebar-section" />

        {showTrash && (
          <button
            type="button"
            className={sc('sidebar-row', 'sidebar-trash', globalFilter === 'trash' && 'selected')}
            onClick={goToTrash}
            aria-pressed={globalFilter === 'trash'}
          >
            <span className={sc('sidebar-row-icon')} aria-hidden="true">
              <Trash2 size={15} />
            </span>
            <span className={sc('sidebar-row-label')}>Trash</span>
            <span className={sc('sidebar-row-count')}>{globalCounts.deleted}</span>
          </button>
        )}

        {shouldShowPrompt && (
          <div className={sc('sidebar-sync-prompt')}>
            <span>Sync your notes across devices</span>
            <div className={sc('sidebar-sync-prompt-actions')}>
              <button
                type="button"
                className={sc('sidebar-sync-prompt-enable')}
                onClick={() => setIsSyncModalOpen(true)}
              >
                Enable
              </button>
              <button
                type="button"
                className={sc('sidebar-sync-prompt-dismiss')}
                onClick={dismissPrompt}
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
          </div>
        )}
      </div>

      <SidebarFooter appVersion={appVersion} onEnableSyncClick={() => setIsSyncModalOpen(true)} />

      {isCreateNotebookOpen && (
        <NotebookCreateModal
          parentId={createParentId}
          onSubmit={handleCreateNotebook}
          onCancel={closeCreate}
        />
      )}

      <EnableSyncModal isOpen={isSyncModalOpen} onClose={() => setIsSyncModalOpen(false)} />
    </aside>
  );
}
