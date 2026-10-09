import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
  PluginRegistry,
  aiCommandStore,
  loadInitScript,
  type AppAPI,
  type EditorAPI,
} from '@dripnex/plugin-api';
import {
  INIT_JS_TEMPLATE,
  USER_INIT_FILE,
  ensureUserHackFiles,
} from '../../../../main/userHackFiles.js';
import {
  BUILTIN_SELECTION_AI_ACTIONS,
  editorAiContext,
  listSelectionAiCommands,
  selectionAiInstruction,
} from '../selectionAiCommands';

const here = dirname(fileURLToPath(import.meta.url));

function clearAiCommands(): void {
  for (const registration of [...aiCommandStore.getState().registrations]) {
    aiCommandStore.getState().unregister(registration.id);
  }
}

function makeEditorAPI(): EditorAPI {
  return {
    getContent: () => '',
    getSelection: () => ({ from: 0, to: 0 }),
    replaceRange: () => {},
    insertAtCursor: () => {},
    setSelection: () => {},
    getWordCount: () => 0,
    getCharCount: () => 0,
    getLineCount: () => 0,
    onDocChanged: () => () => {},
    onSelectionChanged: () => () => {},
    focus: () => {},
    getView: () => null,
  };
}

function makeAppAPI(): AppAPI {
  return {
    getCurrentNote: () => null,
    searchNotes: async () => [],
    getNoteById: async () => null,
    getNoteTags: async () => [],
    getBacklinks: async () => [],
    listNotes: async () => [],
    listNotebooks: async () => [],
    listTags: async () => [],
    onNoteSelected: () => () => {},
    onNoteCreated: () => () => {},
    onNoteDeleted: () => () => {},
  };
}

const mockDataAPI = {
  getNotes: async () => ({ notes: [], total: 0, hasMore: false }),
  getNote: async () => null,
  searchNotes: async () => ({ results: [], total: 0 }),
  countNotes: async () => 0,
  getNotebooks: async () => [],
  getNotebook: async () => null,
  getTags: async () => [],
  getBacklinks: async () => [],
  getOutgoingLinks: async () => [],
  getGraphData: async () => ({ nodes: [], edges: [] }),
  onNotesChanged: () => () => {},
  onNotebooksChanged: () => () => {},
  onTagsChanged: () => () => {},
} as never;

async function activateInitJs(code: string): Promise<PluginRegistry> {
  const manifest = loadInitScript(code);
  expect(manifest).not.toBeNull();
  const registry = new PluginRegistry();
  expect(registry.load(manifest!)).toBe(true);
  await registry.activate('user-init', makeEditorAPI(), makeAppAPI(), mockDataAPI);
  expect(registry.isActive('user-init')).toBe(true);
  return registry;
}

describe('listSelectionAiCommands', () => {
  afterEach(() => {
    clearAiCommands();
  });

  it('lists built-in Edit with AI actions when nothing is registered', () => {
    const list = listSelectionAiCommands([]);
    expect(list.map(action => action.label)).toEqual(
      BUILTIN_SELECTION_AI_ACTIONS.map(action => action.label)
    );
    expect(list.every(action => action.kind === 'builtin')).toBe(true);
    expect(list.map(action => action.label)).toContain('Proofread');
    expect(list.map(action => action.label)).toContain('Create a Mermaid diagram');
  });

  it('surfaces a registerAiCommand from init.js and can invoke Make this sendable', async () => {
    await activateInitJs(INIT_JS_TEMPLATE);

    const list = listSelectionAiCommands(aiCommandStore.getState().registrations);
    expect(list.filter(action => action.kind === 'builtin')).toHaveLength(
      BUILTIN_SELECTION_AI_ACTIONS.length
    );

    const sendable = list.find(action => action.label === 'Make this sendable');
    expect(sendable).toBeDefined();
    expect(sendable!.kind).toBe('registered');
    expect(sendable!.id).toBe('user-init:make-this-sendable');

    const messy = 'ok so um we should maybe ship friday if thats ok???';
    const { instruction, keepFence } = selectionAiInstruction(sendable!, {
      selection: messy,
      note: `# Draft\n\n${messy}`,
      title: 'Draft',
    });
    expect(keepFence).toBe(false);
    expect(instruction).toContain('Turn messy notes into a document a person would actually send');
    expect(instruction).toContain(messy);
    expect(instruction).toContain('Draft');
  });

  it('keeps built-in actions invocable after init.js registers a command', async () => {
    await activateInitJs(INIT_JS_TEMPLATE);
    const list = listSelectionAiCommands(aiCommandStore.getState().registrations);
    const proofread = list.find(action => action.label === 'Proofread');
    expect(proofread).toBeDefined();
    expect(proofread!.kind).toBe('builtin');

    const { instruction, keepFence } = selectionAiInstruction(proofread!, {
      selection: 'teh list',
      note: 'teh list',
      title: '',
    });
    expect(instruction).toBe('Fix grammar and spelling. Keep the meaning and markdown.');
    expect(keepFence).toBe(false);

    const mermaid = list.find(action => action.label === 'Create a Mermaid diagram');
    expect(
      selectionAiInstruction(mermaid!, { selection: 'flow', note: 'flow', title: '' }).keepFence
    ).toBe(true);
  });

  it('surfaces registerAiCommand from a plugin the same way as init.js', async () => {
    const registry = new PluginRegistry();
    registry.load({
      id: 'writing-pack',
      name: 'Writing pack',
      version: '1.0.0',
      activate(ctx) {
        ctx.registerAiCommand({
          id: 'tighten',
          name: 'Tighten this',
          systemPrompt: 'Cut filler. Keep facts.',
          userPromptTemplate: 'Tighten:\n{{selection}}',
          outputTarget: 'replace',
        });
      },
    });
    await registry.activate('writing-pack', makeEditorAPI(), makeAppAPI(), mockDataAPI);

    const list = listSelectionAiCommands(aiCommandStore.getState().registrations);
    const tighten = list.find(action => action.label === 'Tighten this');
    expect(tighten).toBeDefined();
    expect(tighten!.id).toBe('writing-pack:tighten');
    expect(
      selectionAiInstruction(tighten!, {
        selection: 'very very long',
        note: 'very very long',
        title: '',
      }).instruction
    ).toContain('very very long');

    registry.deactivate('writing-pack');
    expect(
      listSelectionAiCommands(aiCommandStore.getState().registrations).map(a => a.label)
    ).not.toContain('Tighten this');
  });
});

describe('editorAiContext', () => {
  it('reads selection, note, and a leading heading title', () => {
    const note = '# Ship\n\nmessy body';
    const from = note.indexOf('messy');
    const ctx = editorAiContext(note, from, from + 5);
    expect(ctx).toEqual({
      selection: 'messy',
      note,
      title: 'Ship',
    });
  });
});

describe('SelectionToolbar / palette wiring', () => {
  it('reads aiCommandStore in the Edit with AI menu', () => {
    const toolbar = readFileSync(join(here, '../SelectionToolbar.tsx'), 'utf-8');
    expect(toolbar).toContain('aiCommandStore');
    expect(toolbar).toContain('listSelectionAiCommands');
    expect(toolbar).toContain('runSelectionAction');
  });

  it('groups category ai in the command palette so registered commands are visible', () => {
    const palette = readFileSync(join(here, '../../CommandPalette.tsx'), 'utf-8');
    expect(palette).toContain("category: 'ai'");
    expect(palette).toContain("label: 'AI'");
  });
});

describe('existing init.js is not rewritten', () => {
  it('ensureUserHackFiles leaves on-disk init.js alone', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'dripnex-ai-cmd-'));
    try {
      const initPath = join(dataRoot, USER_INIT_FILE);
      await writeFile(
        initPath,
        "dripnex.registerAiCommand({ id: 'keep', name: 'Keep' });\n",
        'utf-8'
      );
      await ensureUserHackFiles(dataRoot);
      expect(await readFile(initPath, 'utf-8')).toBe(
        "dripnex.registerAiCommand({ id: 'keep', name: 'Keep' });\n"
      );
    } finally {
      await rm(dataRoot, { recursive: true, force: true });
    }
  });
});
