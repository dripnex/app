import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Link,
  Heading2,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  FileCode,
  Minus,
  Undo2,
  Redo2,
  Plus,
  Copy,
  Search,
  Columns,
  Share2,
  Settings,
  Terminal,
  FileText,
  Keyboard,
  Palette,
  RefreshCw,
  Hash,
  BookMarked,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { CommandCategory } from '@dripnex/command-registry';
import { LayoutZone } from '@dripnex/plugin-api';
import {
  useCommandRegistry,
  dispatchCommand,
  formatKeybinding,
  registry,
} from '../hooks/useCommandRegistry';
import { useNotebooks } from '../hooks/useNotebooks';
import { useTags } from '../hooks/useNotes';
import {
  PALETTE_MODE_COMMANDS,
  filterByQuery,
  notebookPath,
  paletteAriaLabel,
  palettePlaceholder,
  type PaletteMode,
} from '../utils/paletteQuery';
import { cssm } from '../lib/cssm';
import styles from './CommandPalette.module.css';

const sc = cssm(styles);

interface CommandPaletteProps {
  isOpen: boolean;
  mode: PaletteMode;
  onClose: () => void;
  onOpenNote?: (id: string) => void;
  onJumpNotebook?: (id: string) => void;
  onJumpTag?: (name: string) => void;
}

interface NoteHit {
  id: string;
  title: string;
}

const ICON_MAP: Record<string, LucideIcon> = {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Link,
  Heading2,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  FileCode,
  Minus,
  Undo2,
  Redo2,
  Plus,
  Copy,
  Search,
  Columns,
  Share2,
  Settings,
  Terminal,
  FileText,
  Keyboard,
  Palette,
  RefreshCw,
  Hash,
  BookMarked,
};

const CATEGORY_ORDER: { category: CommandCategory; label: string }[] = [
  { category: 'editor', label: 'Editor' },
  { category: 'editor:history', label: 'History' },
  { category: 'view', label: 'View' },
  { category: 'note', label: 'Note' },
  { category: 'navigation', label: 'Navigation' },
  { category: 'app', label: 'App' },
  { category: 'data', label: 'Data' },
  { category: 'plugin', label: 'Plugins' },
];

export function CommandPalette({
  isOpen,
  mode,
  onClose,
  onOpenNote,
  onJumpNotebook,
  onJumpTag,
}: CommandPaletteProps) {
  const commands = useCommandRegistry();
  const { data: notebooks = [] } = useNotebooks();
  const { data: tags = [] } = useTags();
  const [query, setQuery] = useState('');
  const [noteHits, setNoteHits] = useState<NoteHit[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const filteredCommands = useMemo(() => {
    if (mode !== 'commands') return [];
    return commands.filter(cmd => {
      if (cmd.showInPalette === false) return false;
      if (cmd.enabled === false) return false;
      if (query) return cmd.name.toLowerCase().includes(query.toLowerCase());
      return true;
    });
  }, [commands, query, mode]);

  const groups = useMemo(() => {
    const result: {
      category: CommandCategory;
      label: string;
      commands: typeof filteredCommands;
    }[] = [];
    for (const { category, label } of CATEGORY_ORDER) {
      const cmds = filteredCommands.filter(c => c.category === category);
      if (cmds.length > 0) result.push({ category, label, commands: cmds });
    }
    return result;
  }, [filteredCommands]);

  const notebookHits = useMemo(() => {
    if (mode !== 'notebooks') return [];
    return filterByQuery(notebooks, query, nb => notebookPath(notebooks, nb.id));
  }, [mode, notebooks, query]);

  const tagHits = useMemo(() => {
    if (mode !== 'tags') return [];
    return filterByQuery(tags, query, tag => String(tag));
  }, [mode, tags, query]);

  type FlatItem =
    | { type: 'note'; id: string; title: string }
    | { type: 'notebook'; id: string; title: string }
    | { type: 'tag'; id: string; title: string }
    | { type: 'command'; id: string };

  const flatItems = useMemo((): FlatItem[] => {
    if (mode === 'notes') {
      return noteHits.map(note => ({ type: 'note', id: note.id, title: note.title }));
    }
    if (mode === 'notebooks') {
      return notebookHits.map(nb => ({
        type: 'notebook',
        id: nb.id,
        title: notebookPath(notebooks, nb.id),
      }));
    }
    if (mode === 'tags') {
      return tagHits.map(tag => ({ type: 'tag', id: String(tag), title: String(tag) }));
    }
    return groups.flatMap(g => g.commands.map(cmd => ({ type: 'command' as const, id: cmd.id })));
  }, [mode, noteHits, notebookHits, tagHits, notebooks, groups]);

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement | null;
      setQuery('');
      setNoteHits([]);
      setSelectedIndex(0);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [isOpen, mode]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (!isOpen || mode !== 'notes') return;
    const needle = query.trim();
    let cancelled = false;
    const timer = window.setTimeout(
      () => {
        const req = needle
          ? window.dripnex.notes.search(needle, {
              limit: 12,
              isDeleted: false,
              excludeNotebookIds: ['templates'],
            })
          : window.dripnex.notes.list({
              limit: 12,
              isDeleted: false,
              excludeNotebookIds: ['templates'],
              sortBy: 'updatedAt',
              sortOrder: 'desc',
            });
        void req.then(notes => {
          if (!cancelled) {
            setNoteHits(notes.map(note => ({ id: note.id, title: note.title || 'Untitled' })));
          }
        });
      },
      needle ? 160 : 0
    );
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isOpen, mode, query]);

  useEffect(() => {
    if (!listRef.current) return;
    const active = listRef.current.querySelector('[data-active="true"]');
    if (active) active.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const executeCommand = useCallback(
    (id: string) => {
      if (PALETTE_MODE_COMMANDS.has(id)) {
        void dispatchCommand(id);
        return;
      }
      onClose();
      previousFocusRef.current?.focus();
      void dispatchCommand(id);
    },
    [onClose]
  );

  const finish = useCallback(() => {
    onClose();
    previousFocusRef.current?.focus();
  }, [onClose]);

  const executeItem = useCallback(
    (item: FlatItem | undefined) => {
      if (!item) return;
      if (item.type === 'note') {
        finish();
        onOpenNote?.(item.id);
        return;
      }
      if (item.type === 'notebook') {
        finish();
        onJumpNotebook?.(item.id);
        return;
      }
      if (item.type === 'tag') {
        finish();
        onJumpTag?.(item.id);
        return;
      }
      executeCommand(item.id);
    },
    [executeCommand, finish, onOpenNote, onJumpNotebook, onJumpTag]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          setSelectedIndex(prev => (prev + 1) % Math.max(flatItems.length, 1));
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          setSelectedIndex(prev => (prev - 1 + flatItems.length) % Math.max(flatItems.length, 1));
          break;
        }
        case 'Enter': {
          e.preventDefault();
          executeItem(flatItems[selectedIndex]);
          break;
        }
        case 'Escape': {
          e.preventDefault();
          finish();
          break;
        }
      }
    },
    [flatItems, selectedIndex, executeItem, finish]
  );

  if (!isOpen) return null;

  const groupLabel =
    mode === 'notes'
      ? query.trim()
        ? 'Notes'
        : 'Recent'
      : mode === 'notebooks'
        ? 'Notebooks'
        : mode === 'tags'
          ? 'Tags'
          : null;

  return createPortal(
    <div
      className={sc('command-palette-overlay')}
      onClick={onClose}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-label={paletteAriaLabel(mode)}
      aria-modal="true"
    >
      <div
        className={sc('command-palette')}
        onClick={e => e.stopPropagation()}
        style={{
          colorScheme:
            document.documentElement.getAttribute('data-color-scheme') === 'light'
              ? 'light'
              : 'dark',
        }}
      >
        <div className={sc('command-palette-input-wrapper')}>
          <Search size={16} />
          <input
            ref={inputRef}
            className={sc('command-palette-input')}
            type="text"
            placeholder={palettePlaceholder(mode)}
            value={query}
            onChange={e => setQuery(e.target.value)}
            role="combobox"
            aria-expanded="true"
            aria-controls="command-palette-list"
            aria-activedescendant={
              flatItems[selectedIndex]
                ? `cmd-${flatItems[selectedIndex].type}-${flatItems[selectedIndex].id}`
                : undefined
            }
          />
        </div>

        <div
          ref={listRef}
          className={sc('command-palette-list')}
          id="command-palette-list"
          role="listbox"
        >
          {flatItems.length === 0 ? (
            <div className={sc('command-palette-empty')}>No matches</div>
          ) : mode === 'commands' ? (
            groups.map(group => (
              <div key={group.category} className={sc('command-palette-group')}>
                <div className={sc('command-palette-group-label')}>{group.label}</div>
                {group.commands.map(cmd => {
                  const index = flatItems.findIndex(
                    item => item.type === 'command' && item.id === cmd.id
                  );
                  const isActive = index === selectedIndex;
                  const IconComponent = cmd.icon ? ICON_MAP[cmd.icon] : undefined;
                  const kb = registry.getKeybinding(cmd.id);
                  const kbLabel = formatKeybinding(kb);
                  return (
                    <div
                      key={cmd.id}
                      id={`cmd-command-${cmd.id}`}
                      className={sc(
                        'command-palette-item',
                        isActive && 'command-palette-item--active'
                      )}
                      role="option"
                      aria-selected={isActive}
                      data-active={isActive ? 'true' : undefined}
                      onClick={() => executeCommand(cmd.id)}
                      onMouseEnter={() => setSelectedIndex(index)}
                    >
                      <span className={sc('command-palette-item-icon')}>
                        {IconComponent ? <IconComponent size={14} /> : null}
                      </span>
                      <span className={sc('command-palette-item-name')}>{cmd.name}</span>
                      <span className={sc('command-palette-item-category')}>{group.label}</span>
                      {kbLabel ? (
                        <kbd className={sc('command-palette-item-kbd')}>{kbLabel}</kbd>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ))
          ) : (
            <div className={sc('command-palette-group')}>
              {groupLabel ? (
                <div className={sc('command-palette-group-label')}>{groupLabel}</div>
              ) : null}
              {flatItems.map((item, index) => {
                const isActive = index === selectedIndex;
                const Icon =
                  item.type === 'notebook' ? BookMarked : item.type === 'tag' ? Hash : FileCode;
                const category =
                  item.type === 'notebook' ? 'Notebook' : item.type === 'tag' ? 'Tag' : 'Note';
                return (
                  <div
                    key={`${item.type}-${item.id}`}
                    id={`cmd-${item.type}-${item.id}`}
                    className={sc(
                      'command-palette-item',
                      isActive && 'command-palette-item--active'
                    )}
                    role="option"
                    aria-selected={isActive}
                    data-active={isActive ? 'true' : undefined}
                    onClick={() => executeItem(item)}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <span className={sc('command-palette-item-icon')}>
                      <Icon size={14} />
                    </span>
                    <span className={sc('command-palette-item-name')}>
                      {item.type === 'command' ? item.id : item.title}
                    </span>
                    <span className={sc('command-palette-item-category')}>{category}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <LayoutZone name="command-palette-footer" />
      </div>
    </div>,
    document.body
  );
}
