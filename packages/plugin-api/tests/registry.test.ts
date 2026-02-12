import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PluginRegistry } from '../src/lifecycle/PluginRegistry';
import type { PluginManifest, EditorAPI, AppAPI } from '../src/types';
import type { RegisterCommandFn, ConfigBridge } from '../src/lifecycle/PluginRegistry';
import { remarkPluginStore } from '../src/preview/remarkPluginStore';
import { rehypePluginStore } from '../src/preview/rehypePluginStore';
import { previewComponentStore } from '../src/preview/previewComponentStore';
import { codeBlockStore } from '../src/preview/codeBlockStore';

function makeManifest(overrides: Partial<PluginManifest> = {}): PluginManifest {
  return {
    id: 'test-plugin',
    name: 'Test Plugin',
    version: '1.0.0',
    activate: () => {},
    ...overrides,
  };
}

function makeEditorAPI(): EditorAPI {
  return {
    getContent: () => '',
    getSelection: () => ({ from: 0, to: 0 }),
    replaceRange: () => {},
    insertAtCursor: () => {},
    getWordCount: () => 0,
    getCharCount: () => 0,
    getLineCount: () => 0,
    onDocChanged: () => () => {},
    onSelectionChanged: () => () => {},
    focus: () => {},
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

describe('PluginRegistry', () => {
  let registry: PluginRegistry;

  beforeEach(() => {
    registry = new PluginRegistry();
  });

  describe('load', () => {
    it('loads a valid manifest', () => {
      expect(registry.load(makeManifest())).toBe(true);
      expect(registry.getLoadedIds()).toEqual(['test-plugin']);
    });

    it('rejects invalid manifest', () => {
      const invalid = { id: '', name: '', version: '' } as unknown as PluginManifest;
      expect(registry.load(invalid)).toBe(false);
      expect(registry.getLoadedIds()).toEqual([]);
    });

    it('replaces existing plugin with same id', () => {
      registry.load(makeManifest({ id: 'foo', name: 'First' }));
      registry.load(makeManifest({ id: 'foo', name: 'Second' }));
      expect(registry.getLoadedIds()).toEqual(['foo']);
    });
  });

  describe('activate', () => {
    it('activates a loaded plugin', async () => {
      const activate = vi.fn();
      registry.load(makeManifest({ activate }));
      await registry.activate('test-plugin', makeEditorAPI(), makeAppAPI());

      expect(activate).toHaveBeenCalledOnce();
      expect(registry.isActive('test-plugin')).toBe(true);
    });

    it('passes context with all expected APIs', async () => {
      let receivedContext: unknown = null;
      registry.load(
        makeManifest({
          activate: ctx => {
            receivedContext = ctx;
          },
        })
      );
      await registry.activate('test-plugin', makeEditorAPI(), makeAppAPI());

      const ctx = receivedContext as Record<string, unknown>;
      expect(ctx).toHaveProperty('layout');
      expect(ctx).toHaveProperty('editor');
      expect(ctx).toHaveProperty('registerExtensions');
      expect(ctx).toHaveProperty('registerCommand');
      expect(ctx).toHaveProperty('registerRemarkPlugin');
      expect(ctx).toHaveProperty('registerRehypePlugin');
      expect(ctx).toHaveProperty('registerPreviewComponent');
      expect(ctx).toHaveProperty('registerCodeBlockRenderer');
      expect(ctx).toHaveProperty('registerCssVariables');
      expect(ctx).toHaveProperty('config');
      expect(ctx).toHaveProperty('log');
      expect(ctx).toHaveProperty('app');
    });

    it('exposes data listing methods on context.app', async () => {
      let receivedApp: unknown = null;
      registry.load(
        makeManifest({
          activate: ctx => {
            receivedApp = ctx.app;
          },
        })
      );
      await registry.activate('test-plugin', makeEditorAPI(), makeAppAPI());

      const app = receivedApp as Record<string, unknown>;
      expect(app).toHaveProperty('listNotes');
      expect(app).toHaveProperty('listNotebooks');
      expect(app).toHaveProperty('listTags');
      expect(typeof app.listNotes).toBe('function');
      expect(typeof app.listNotebooks).toBe('function');
      expect(typeof app.listTags).toBe('function');
    });

    it('does nothing for non-existent plugin', async () => {
      await expect(
        registry.activate('nope', makeEditorAPI(), makeAppAPI())
      ).resolves.toBeUndefined();
    });

    it('does nothing if already active', async () => {
      const activate = vi.fn();
      registry.load(makeManifest({ activate }));
      await registry.activate('test-plugin', makeEditorAPI(), makeAppAPI());
      await registry.activate('test-plugin', makeEditorAPI(), makeAppAPI());

      expect(activate).toHaveBeenCalledOnce();
    });

    it('hydrates config from bridge', async () => {
      let configValue: unknown;
      registry.load(
        makeManifest({
          activate: ctx => {
            configValue = ctx.config.get('theme');
          },
        })
      );

      const configBridge: ConfigBridge = {
        getAll: async () => ({ theme: 'dark' }),
        set: async () => {},
      };

      await registry.activate(
        'test-plugin',
        makeEditorAPI(),
        makeAppAPI(),
        undefined,
        configBridge
      );
      expect(configValue).toBe('dark');
    });

    it('config.set writes to bridge', async () => {
      const setBridge = vi.fn().mockResolvedValue(undefined);
      const configBridge: ConfigBridge = {
        getAll: async () => ({}),
        set: setBridge,
      };

      registry.load(
        makeManifest({
          activate: ctx => {
            ctx.config.set('font', 'mono');
          },
        })
      );

      await registry.activate(
        'test-plugin',
        makeEditorAPI(),
        makeAppAPI(),
        undefined,
        configBridge
      );
      expect(setBridge).toHaveBeenCalledWith('test-plugin', 'font', 'mono');
    });
  });

  describe('command registration', () => {
    it('prefixes command ids with plugin namespace', async () => {
      const registerCommandFn: RegisterCommandFn = vi.fn().mockReturnValue(() => {});

      registry.load(
        makeManifest({
          activate: ctx => {
            ctx.registerCommand({ id: 'toggle', name: 'Toggle' }, () => {});
          },
        })
      );

      await registry.activate('test-plugin', makeEditorAPI(), makeAppAPI(), registerCommandFn);

      expect(registerCommandFn).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'plugin:test-plugin:toggle' })
      );
    });

    it('sets showInPalette true by default', async () => {
      const registerCommandFn: RegisterCommandFn = vi.fn().mockReturnValue(() => {});

      registry.load(
        makeManifest({
          activate: ctx => {
            ctx.registerCommand({ id: 'cmd', name: 'Cmd' }, () => {});
          },
        })
      );

      await registry.activate('test-plugin', makeEditorAPI(), makeAppAPI(), registerCommandFn);

      expect(registerCommandFn).toHaveBeenCalledWith(
        expect.objectContaining({ showInPalette: true })
      );
    });

    it('cleans up commands on deactivate', async () => {
      const unregister = vi.fn();
      const registerCommandFn: RegisterCommandFn = vi.fn().mockReturnValue(unregister);

      registry.load(
        makeManifest({
          activate: ctx => {
            ctx.registerCommand({ id: 'cmd', name: 'Cmd' }, () => {});
          },
        })
      );

      await registry.activate('test-plugin', makeEditorAPI(), makeAppAPI(), registerCommandFn);
      registry.deactivate('test-plugin');

      expect(unregister).toHaveBeenCalledOnce();
    });
  });

  describe('deactivate', () => {
    it('calls dispose on disposable returned by activate', async () => {
      const dispose = vi.fn();
      registry.load(
        makeManifest({
          activate: () => ({ dispose }),
        })
      );

      await registry.activate('test-plugin', makeEditorAPI(), makeAppAPI());
      registry.deactivate('test-plugin');

      expect(dispose).toHaveBeenCalledOnce();
    });

    it('calls deactivate lifecycle method', async () => {
      const deactivate = vi.fn();
      registry.load(makeManifest({ deactivate }));

      await registry.activate('test-plugin', makeEditorAPI(), makeAppAPI());
      registry.deactivate('test-plugin');

      expect(deactivate).toHaveBeenCalledOnce();
    });

    it('does nothing for non-existent plugin', () => {
      expect(() => registry.deactivate('nope')).not.toThrow();
    });

    it('does nothing for inactive plugin', () => {
      registry.load(makeManifest());
      expect(() => registry.deactivate('test-plugin')).not.toThrow();
    });

    it('marks plugin as deactivated', async () => {
      registry.load(makeManifest());
      await registry.activate('test-plugin', makeEditorAPI(), makeAppAPI());
      registry.deactivate('test-plugin');

      expect(registry.isActive('test-plugin')).toBe(false);
      // Still loaded
      expect(registry.getLoadedIds()).toContain('test-plugin');
    });
  });

  describe('unload', () => {
    it('deactivates and removes plugin', async () => {
      const dispose = vi.fn();
      registry.load(makeManifest({ activate: () => ({ dispose }) }));
      await registry.activate('test-plugin', makeEditorAPI(), makeAppAPI());

      registry.unload('test-plugin');

      expect(dispose).toHaveBeenCalledOnce();
      expect(registry.getLoadedIds()).toEqual([]);
      expect(registry.isActive('test-plugin')).toBe(false);
    });

    it('handles unloading an inactive plugin', () => {
      registry.load(makeManifest());
      registry.unload('test-plugin');
      expect(registry.getLoadedIds()).toEqual([]);
    });
  });

  describe('event auto-cleanup', () => {
    it('auto-unsubscribes leaked editor event listeners on deactivate', async () => {
      const editorUnsub = vi.fn();
      const editorAPI = makeEditorAPI();
      editorAPI.onSelectionChanged = vi.fn().mockReturnValue(editorUnsub);

      registry.load(
        makeManifest({
          activate: ctx => {
            // Subscribe but intentionally DO NOT unsubscribe in dispose
            ctx.editor.onSelectionChanged(() => {});
            return { dispose() {} };
          },
        })
      );

      await registry.activate('test-plugin', editorAPI, makeAppAPI());
      registry.deactivate('test-plugin');

      expect(editorUnsub).toHaveBeenCalledOnce();
    });

    it('auto-unsubscribes leaked app event listeners on deactivate', async () => {
      const appUnsub = vi.fn();
      const appAPI = makeAppAPI();
      appAPI.onNoteSelected = vi.fn().mockReturnValue(appUnsub);

      registry.load(
        makeManifest({
          activate: ctx => {
            ctx.app.onNoteSelected(() => {});
            return { dispose() {} };
          },
        })
      );

      await registry.activate('test-plugin', makeEditorAPI(), appAPI);
      registry.deactivate('test-plugin');

      expect(appUnsub).toHaveBeenCalledOnce();
    });

    it('does not double-unsubscribe if plugin cleaned up properly', async () => {
      const editorUnsub = vi.fn();
      const editorAPI = makeEditorAPI();
      editorAPI.onDocChanged = vi.fn().mockReturnValue(editorUnsub);

      registry.load(
        makeManifest({
          activate: ctx => {
            const off = ctx.editor.onDocChanged(() => {});
            return {
              dispose() {
                off(); // Plugin properly cleans up
              },
            };
          },
        })
      );

      await registry.activate('test-plugin', editorAPI, makeAppAPI());
      registry.deactivate('test-plugin');

      // The tracked wrapper calls the real unsub, then removes itself from the list.
      // deactivate() iterates remaining list — should be empty, so no extra call.
      expect(editorUnsub).toHaveBeenCalledOnce();
    });

    it('cleans up multiple listeners across editor and app', async () => {
      const editorDocUnsub = vi.fn();
      const editorSelUnsub = vi.fn();
      const appNoteSelUnsub = vi.fn();
      const appNoteCreatedUnsub = vi.fn();
      const appNoteDeletedUnsub = vi.fn();

      const editorAPI = makeEditorAPI();
      editorAPI.onDocChanged = vi.fn().mockReturnValue(editorDocUnsub);
      editorAPI.onSelectionChanged = vi.fn().mockReturnValue(editorSelUnsub);

      const appAPI = makeAppAPI();
      appAPI.onNoteSelected = vi.fn().mockReturnValue(appNoteSelUnsub);
      appAPI.onNoteCreated = vi.fn().mockReturnValue(appNoteCreatedUnsub);
      appAPI.onNoteDeleted = vi.fn().mockReturnValue(appNoteDeletedUnsub);

      registry.load(
        makeManifest({
          activate: ctx => {
            ctx.editor.onDocChanged(() => {});
            ctx.editor.onSelectionChanged(() => {});
            ctx.app.onNoteSelected(() => {});
            ctx.app.onNoteCreated(() => {});
            ctx.app.onNoteDeleted(() => {});
            // No cleanup in dispose — all should be auto-cleaned
            return { dispose() {} };
          },
        })
      );

      await registry.activate('test-plugin', editorAPI, appAPI);
      registry.deactivate('test-plugin');

      expect(editorDocUnsub).toHaveBeenCalledOnce();
      expect(editorSelUnsub).toHaveBeenCalledOnce();
      expect(appNoteSelUnsub).toHaveBeenCalledOnce();
      expect(appNoteCreatedUnsub).toHaveBeenCalledOnce();
      expect(appNoteDeletedUnsub).toHaveBeenCalledOnce();
    });
  });

  describe('decorations', () => {
    it('provides decorations API in context', async () => {
      let hasDecorations = false;
      registry.load(
        makeManifest({
          activate: ctx => {
            hasDecorations =
              typeof ctx.decorations.addLineHighlight === 'function' &&
              typeof ctx.decorations.addWidget === 'function' &&
              typeof ctx.decorations.clear === 'function';
          },
        })
      );

      await registry.activate('test-plugin', makeEditorAPI(), makeAppAPI());
      expect(hasDecorations).toBe(true);
    });
  });

  describe('logger', () => {
    it('provides namespaced logger to plugins', async () => {
      const logSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

      registry.load(
        makeManifest({
          activate: ctx => {
            ctx.log.info('hello');
          },
        })
      );

      await registry.activate('test-plugin', makeEditorAPI(), makeAppAPI());

      expect(logSpy).toHaveBeenCalledWith('[test-plugin]', 'hello');
      logSpy.mockRestore();
    });
  });

  describe('preview plugin registration', () => {
    beforeEach(() => {
      // Clean all preview stores
      for (const r of remarkPluginStore.getState().registrations) {
        remarkPluginStore.getState().unregister(r.id);
      }
      for (const r of rehypePluginStore.getState().registrations) {
        rehypePluginStore.getState().unregister(r.id);
      }
      for (const r of previewComponentStore.getState().registrations) {
        previewComponentStore.getState().unregister(r.id);
      }
      for (const r of codeBlockStore.getState().registrations) {
        codeBlockStore.getState().unregister(r.id);
      }
    });

    it('registerRemarkPlugin adds to remarkPluginStore', async () => {
      const fakePlugin = () => {};
      registry.load(
        makeManifest({
          activate: ctx => {
            ctx.registerRemarkPlugin('my-remark', fakePlugin);
          },
        })
      );

      await registry.activate('test-plugin', makeEditorAPI(), makeAppAPI());

      const regs = remarkPluginStore.getState().registrations;
      expect(regs).toHaveLength(1);
      expect(regs[0]!.id).toBe('my-remark');
      expect(regs[0]!.pluginId).toBe('test-plugin');
      expect(regs[0]!.plugin).toBe(fakePlugin);
    });

    it('registerRehypePlugin adds to rehypePluginStore', async () => {
      const fakePlugin = () => {};
      registry.load(
        makeManifest({
          activate: ctx => {
            ctx.registerRehypePlugin('my-rehype', fakePlugin);
          },
        })
      );

      await registry.activate('test-plugin', makeEditorAPI(), makeAppAPI());

      const regs = rehypePluginStore.getState().registrations;
      expect(regs).toHaveLength(1);
      expect(regs[0]!.id).toBe('my-rehype');
      expect(regs[0]!.pluginId).toBe('test-plugin');
    });

    it('registerPreviewComponent adds to previewComponentStore', async () => {
      const FakeComp = () => null;
      registry.load(
        makeManifest({
          activate: ctx => {
            ctx.registerPreviewComponent('my-comp', 'table', FakeComp);
          },
        })
      );

      await registry.activate('test-plugin', makeEditorAPI(), makeAppAPI());

      const regs = previewComponentStore.getState().registrations;
      expect(regs).toHaveLength(1);
      expect(regs[0]!.tagName).toBe('table');
    });

    it('registerCodeBlockRenderer adds to codeBlockStore', async () => {
      const MermaidRenderer = () => null;
      registry.load(
        makeManifest({
          activate: ctx => {
            ctx.registerCodeBlockRenderer('mermaid', 'mermaid', MermaidRenderer);
          },
        })
      );

      await registry.activate('test-plugin', makeEditorAPI(), makeAppAPI());

      const regs = codeBlockStore.getState().registrations;
      expect(regs).toHaveLength(1);
      expect(regs[0]!.language).toBe('mermaid');
    });

    it('unregister functions remove from stores', async () => {
      let unregRemark: () => void;
      let unregRehype: () => void;

      registry.load(
        makeManifest({
          activate: ctx => {
            unregRemark = ctx.registerRemarkPlugin('remark-1', () => {});
            unregRehype = ctx.registerRehypePlugin('rehype-1', () => {});
          },
        })
      );

      await registry.activate('test-plugin', makeEditorAPI(), makeAppAPI());
      expect(remarkPluginStore.getState().registrations).toHaveLength(1);
      expect(rehypePluginStore.getState().registrations).toHaveLength(1);

      unregRemark!();
      unregRehype!();

      expect(remarkPluginStore.getState().registrations).toHaveLength(0);
      expect(rehypePluginStore.getState().registrations).toHaveLength(0);
    });

    it('deactivate cleans up all preview stores', async () => {
      registry.load(
        makeManifest({
          activate: ctx => {
            ctx.registerRemarkPlugin('remark-1', () => {});
            ctx.registerRehypePlugin('rehype-1', () => {});
            ctx.registerPreviewComponent('comp-1', 'table', () => null);
            ctx.registerCodeBlockRenderer('code-1', 'mermaid', () => null);
          },
        })
      );

      await registry.activate('test-plugin', makeEditorAPI(), makeAppAPI());

      // Verify all stores have registrations
      expect(remarkPluginStore.getState().registrations).toHaveLength(1);
      expect(rehypePluginStore.getState().registrations).toHaveLength(1);
      expect(previewComponentStore.getState().registrations).toHaveLength(1);
      expect(codeBlockStore.getState().registrations).toHaveLength(1);

      registry.deactivate('test-plugin');

      // All stores should be empty
      expect(remarkPluginStore.getState().registrations).toHaveLength(0);
      expect(rehypePluginStore.getState().registrations).toHaveLength(0);
      expect(previewComponentStore.getState().registrations).toHaveLength(0);
      expect(codeBlockStore.getState().registrations).toHaveLength(0);
    });
  });

  describe('error isolation', () => {
    it('catches activate() errors and marks plugin as error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      registry.load(
        makeManifest({
          activate: () => {
            throw new Error('Plugin crashed!');
          },
        })
      );

      await registry.activate('test-plugin', makeEditorAPI(), makeAppAPI());

      expect(registry.isActive('test-plugin')).toBe(false);
      expect(registry.hasError('test-plugin')).toBe(true);
      expect(registry.getError('test-plugin')).toEqual({
        message: 'Plugin crashed!',
        count: 1,
      });

      consoleSpy.mockRestore();
    });

    it('cleans up partial registrations on activate error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Clean preview stores
      for (const r of remarkPluginStore.getState().registrations) {
        remarkPluginStore.getState().unregister(r.id);
      }

      registry.load(
        makeManifest({
          activate: ctx => {
            // Register something before crashing
            ctx.registerRemarkPlugin('partial-remark', () => {});
            throw new Error('Crash after partial setup');
          },
        })
      );

      await registry.activate('test-plugin', makeEditorAPI(), makeAppAPI());

      // Partial registrations should be cleaned up
      expect(remarkPluginStore.getState().registrations).toHaveLength(0);
      expect(registry.hasError('test-plugin')).toBe(true);

      consoleSpy.mockRestore();
    });

    it('catches dispose() errors without crashing deactivate', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      registry.load(
        makeManifest({
          activate: () => ({
            dispose() {
              throw new Error('dispose crashed');
            },
          }),
        })
      );

      await registry.activate('test-plugin', makeEditorAPI(), makeAppAPI());
      expect(registry.isActive('test-plugin')).toBe(true);

      // Should not throw
      expect(() => registry.deactivate('test-plugin')).not.toThrow();
      expect(registry.isActive('test-plugin')).toBe(false);

      consoleSpy.mockRestore();
    });

    it('catches deactivate() lifecycle errors without crashing', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      registry.load(
        makeManifest({
          deactivate: () => {
            throw new Error('deactivate lifecycle crashed');
          },
        })
      );

      await registry.activate('test-plugin', makeEditorAPI(), makeAppAPI());

      expect(() => registry.deactivate('test-plugin')).not.toThrow();
      expect(registry.isActive('test-plugin')).toBe(false);

      consoleSpy.mockRestore();
    });

    it('getError returns null for non-error plugins', () => {
      registry.load(makeManifest());
      expect(registry.getError('test-plugin')).toBeNull();
      expect(registry.hasError('test-plugin')).toBe(false);
    });

    it('getError returns null for unknown plugins', () => {
      expect(registry.getError('nonexistent')).toBeNull();
      expect(registry.hasError('nonexistent')).toBe(false);
    });
  });
});
