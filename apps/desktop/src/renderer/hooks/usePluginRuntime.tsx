import { useCallback, useEffect, useMemo, useState, type ReactNode, type RefObject } from 'react';
import { EditorView } from '@codemirror/view';
import {
  PluginHost,
  createEditorAPI,
  createAppAPI,
  createDataAPI,
  editorPluginStore,
  pluginMenuStore,
  setHostCommandDispatch,
  applyPluginConfig,
} from '@dripnex/plugin-api';
import type { EditorAPIWithEvents, AppAPIWithEvents, DataAPIWithEvents } from '@dripnex/plugin-api';
import type { RegisteredCommand } from '@dripnex/command-registry';
import { useStore } from 'zustand';
import type { NoteSnapshot } from '../../preload/index';
import { getEditorView, registry as commandRegistry } from './useCommandRegistry';
import { builtInPlugins } from '../plugins';
import { pluginRuntimeStore, type PluginLoadError } from '../stores/pluginRuntimeStore';
import { useToast } from '../components/Toast';

function PluginErrorNotifier({ errors }: { errors: PluginLoadError[] }) {
  const { showToast } = useToast();

  useEffect(() => {
    for (const err of errors) {
      showToast(`Plugin "${err.pluginName}" failed to load`, 'error');
    }
  }, [errors, showToast]);

  return null;
}

export function usePluginRuntime(selectedNoteRef: RefObject<NoteSnapshot | null>): {
  editorAPI: EditorAPIWithEvents;
  appAPI: AppAPIWithEvents;
  dataAPI: DataAPIWithEvents;
  pluginSlot: ReactNode;
} {
  const editorAPI = useMemo<EditorAPIWithEvents>(() => createEditorAPI(getEditorView), []);

  const appAPI = useMemo<AppAPIWithEvents>(
    () =>
      createAppAPI({
        getCurrentNote() {
          const note = selectedNoteRef.current;
          if (!note) return null;
          return { id: note.id, title: note.title, content: note.content };
        },
        async searchNotes(query) {
          const notes = await window.dripnex.notes.search(query, 20);
          return notes.map(n => ({ id: n.id, title: n.title }));
        },
        async getNoteById(id) {
          const result = await window.dripnex.notes.get(id);
          if (!result.ok) return null;
          return { id: result.data.id, title: result.data.title, content: result.data.content };
        },
        async getNoteTags(noteId) {
          return window.dripnex.notes.getManualTags(noteId);
        },
        async getBacklinks(noteId) {
          const links = await window.dripnex.links.getBacklinks(noteId);
          return links.map(l => ({ noteId: l.noteId, noteTitle: l.noteTitle }));
        },
        async listNotes() {
          const notes = await window.dripnex.notes.list();
          return notes.map(n => ({
            id: n.id,
            title: n.title,
            notebookId: n.notebookId,
            tags: [...n.tags],
            wordCount: n.wordCount,
            createdAt: n.createdAt,
            updatedAt: n.updatedAt,
            isPinned: n.isPinned,
            status: n.status,
          }));
        },
        async listNotebooks() {
          const notebooks = await window.dripnex.notebooks.list();
          return notebooks.map(nb => ({
            id: nb.id,
            name: nb.name,
            parentId: nb.parentId,
          }));
        },
        async listTags() {
          return window.dripnex.notes.tags();
        },
      }),
    [selectedNoteRef]
  );

  const dataAPI = useMemo<DataAPIWithEvents>(
    () =>
      createDataAPI({
        async getNotes(options) {
          const notes = await window.dripnex.notes.list(
            options
              ? {
                  tag: options.tag,
                  sortBy: options.sortBy === 'wordCount' ? 'updatedAt' : options.sortBy,
                  sortOrder: options.sortOrder,
                }
              : undefined
          );
          let filtered = notes;
          if (options?.notebookId)
            filtered = filtered.filter(n => n.notebookId === options.notebookId);
          if (options?.status) filtered = filtered.filter(n => n.status === options.status);
          if (options?.isPinned !== undefined)
            filtered = filtered.filter(n => n.isPinned === options.isPinned);

          if (options?.sortBy === 'wordCount') {
            const dir = options.sortOrder === 'asc' ? 1 : -1;
            filtered = [...filtered].sort((a, b) => dir * (a.wordCount - b.wordCount));
          }

          const total = filtered.length;

          if (options?.offset || options?.limit) {
            const start = options.offset ?? 0;
            const end = options.limit ? start + options.limit : undefined;
            filtered = filtered.slice(start, end);
          }

          return {
            notes: filtered.map(n => ({
              id: n.id,
              title: n.title,
              notebookId: n.notebookId,
              tags: [...n.tags],
              wordCount: n.wordCount,
              createdAt: n.createdAt,
              updatedAt: n.updatedAt,
              isPinned: n.isPinned,
              status: n.status,
            })),
            total,
          };
        },
        async getNote(id) {
          const result = await window.dripnex.notes.get(id);
          if (!result.ok) return null;
          return { id: result.data.id, title: result.data.title, content: result.data.content };
        },
        async searchNotes(query, options) {
          const notes = await window.dripnex.notes.search(query, options?.limit ?? 20);
          return {
            results: notes.map(n => ({ id: n.id, title: n.title })),
            total: notes.length,
          };
        },
        async countNotes() {
          const counts = await window.dripnex.notes.count();
          return counts.total;
        },
        async getNotebooks() {
          const notebooks = await window.dripnex.notebooks.list();
          return notebooks.map(nb => ({ id: nb.id, name: nb.name, parentId: nb.parentId }));
        },
        async getNotebookTree() {
          type TreeNode = {
            id: string;
            name: string;
            parentId: string | null;
            noteCount: number;
            childCount: number;
            children: TreeNode[];
          };
          const tree = await window.dripnex.notebooks.tree();
          const mapNode = (node: {
            notebook: {
              id: string;
              name: string;
              parentId: string | null;
              noteCount?: number;
            };
            children: unknown[];
          }): TreeNode => ({
            id: node.notebook.id,
            name: node.notebook.name,
            parentId: node.notebook.parentId,
            noteCount: node.notebook.noteCount ?? 0,
            childCount: node.children.length,
            children: (node.children as typeof tree).map(mapNode),
          });
          return tree.map(mapNode);
        },
        async getNotebook(id) {
          const nb = await window.dripnex.notebooks.getWithMetadata(id);
          if (!nb) return null;
          return {
            id: nb.id,
            name: nb.name,
            parentId: nb.parentId,
            noteCount: nb.noteCount,
            childCount: nb.childCount,
          };
        },
        async getTags() {
          return window.dripnex.notes.tags();
        },
        async getTagsWithColors() {
          return window.dripnex.notes.tagsWithColors();
        },
        async queryTags(options) {
          const rows = await window.dripnex.notes.queryTags({
            filter: options?.filter,
            limit: options?.limit,
            offset: options?.offset,
            includeCount: options?.includeCount,
          });
          return rows.map(row => ({
            name: row.name,
            color: options?.includeColors ? row.color : undefined,
            count: row.count,
          }));
        },
        async getBacklinks(noteId) {
          const links = await window.dripnex.links.getBacklinks(noteId);
          return links.map(l => ({ noteId: l.noteId, noteTitle: l.noteTitle }));
        },
        async getOutgoingLinks(noteId) {
          const links = await window.dripnex.links.getOutgoing(noteId);
          return links.map(l => ({
            targetId: l.targetNoteId,
            targetTitle: l.targetTitle ?? l.targetRef,
            resolved: l.targetNoteId !== null,
          }));
        },
        async getGraphData() {
          return window.dripnex.links.getGraph();
        },
      }),
    []
  );

  const discoveredPlugins = useStore(pluginRuntimeStore, s => s.plugins);
  const pluginErrors = useStore(pluginRuntimeStore, s => s.errors);
  const [builtInEnabledMap, setBuiltInEnabledMap] = useState<Record<string, boolean> | null>(null);

  useEffect(() => {
    void pluginRuntimeStore.getState().init();
    void (async () => {
      const stateList = await window.dripnex.plugins.listState();
      const map: Record<string, boolean> = {};
      for (const s of stateList) {
        map[s.pluginId] = s.enabled;
      }
      setBuiltInEnabledMap(map);
    })();
  }, []);

  useEffect(() => {
    const handler = () => {
      void (async () => {
        const stateList = await window.dripnex.plugins.listState();
        const map: Record<string, boolean> = {};
        for (const s of stateList) {
          map[s.pluginId] = s.enabled;
        }
        setBuiltInEnabledMap(map);
      })();
    };
    return window.dripnex.ipc.on('plugins:reload', handler);
  }, []);

  useEffect(() => {
    const sync = () => {
      window.dripnex.plugins.setMenuItems(pluginMenuStore.getState().items);
    };
    sync();
    const unsub = pluginMenuStore.subscribe(sync);
    const offInvoke = window.dripnex.ipc.on('menu:invoke', (...args: unknown[]) => {
      const commandId = typeof args[0] === 'string' ? args[0] : undefined;
      if (commandId) void commandRegistry.dispatch(commandId);
    });
    return () => {
      unsub();
      offInvoke();
    };
  }, []);

  const allPlugins = useMemo(() => {
    const enabledBuiltIn = builtInEnabledMap
      ? builtInPlugins.filter(p => builtInEnabledMap[p.id] !== false)
      : [];
    return [...enabledBuiltIn, ...discoveredPlugins];
  }, [discoveredPlugins, builtInEnabledMap]);

  const configBridge = useMemo(
    () => ({
      getAll: (pluginId: string) => window.dripnex.pluginConfig.getAll(pluginId),
      set: (pluginId: string, key: string, value: unknown) =>
        window.dripnex.pluginConfig.set(pluginId, key, value),
    }),
    []
  );

  const registerPluginCommand = useCallback(
    (cmd: Record<string, unknown>) => commandRegistry.register(cmd as unknown as RegisteredCommand),
    []
  );

  useEffect(() => {
    setHostCommandDispatch(id => commandRegistry.dispatch(id));
    return () => setHostCommandDispatch(null);
  }, []);

  useEffect(() => {
    return window.dripnex.ipc.on('pluginConfig:changed', (...args: unknown[]) => {
      const pluginId = typeof args[0] === 'string' ? args[0] : null;
      const key = typeof args[1] === 'string' ? args[1] : null;
      if (!pluginId || !key) return;
      applyPluginConfig(pluginId, key, args[2]);
    });
  }, []);

  useEffect(() => {
    const ext = EditorView.updateListener.of(update => {
      if (update.docChanged) {
        editorAPI._notifyDocChanged(update.state.doc.toString());
      }
      if (update.selectionSet) {
        const sel = update.state.selection.main;
        editorAPI._notifySelectionChanged({ from: sel.from, to: sel.to });
      }
    });

    editorPluginStore.getState().register({
      id: '__editor-event-bridge',
      pluginId: '__system',
      extensions: [ext],
    });

    return () => {
      editorPluginStore.getState().unregister('__editor-event-bridge');
    };
  }, [editorAPI]);

  const pluginSlot = (
    <>
      <PluginHost
        plugins={allPlugins}
        editorAPI={editorAPI}
        appAPI={appAPI}
        dataAPI={dataAPI}
        registerCommand={registerPluginCommand}
        configBridge={configBridge}
        getView={getEditorView}
      />
      <PluginErrorNotifier errors={pluginErrors} />
    </>
  );

  return { editorAPI, appAPI, dataAPI, pluginSlot };
}
