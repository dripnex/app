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
import { cssm } from '../lib/cssm';
import styles from './CommandPalette.module.css';

const sc = cssm(styles);

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenNote?: (id: string) => void;
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

export function CommandPalette({ isOpen, onClose, onOpenNote }: CommandPaletteProps) {
  const commands = useCommandRegistry();
  const [query, setQuery] = useState('');
  const [noteHits, setNoteHits] = useState<NoteHit[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Filter commands: visible in palette and enabled
  const filtered = useMemo(() => {
    return commands.filter(cmd => {
      if (cmd.showInPalette === false) return false;
      if (cmd.enabled === false) return false;
      if (query) {
        return cmd.name.toLowerCase().includes(query.toLowerCase());
      }
      return true;
    });
  }, [commands, query]);

  // Group by category in fixed order
  const groups = useMemo(() => {
    const result: { category: CommandCategory; label: string; commands: typeof filtered }[] = [];
    for (const { category, label } of CATEGORY_ORDER) {
      const cmds = filtered.filter(c => c.category === category);
      if (cmds.length > 0) {
        result.push({ category, label, commands: cmds });
      }
    }
    return result;
  }, [filtered]);

  type FlatItem = { type: 'note'; id: string; title: string } | { type: 'command'; id: string };

  const flatItems = useMemo((): FlatItem[] => {
    const notes: FlatItem[] = noteHits.map(note => ({
      type: 'note',
      id: note.id,
      title: note.title,
    }));
    const cmds: FlatItem[] = groups.flatMap(g =>
      g.commands.map(cmd => ({ type: 'command' as const, id: cmd.id }))
    );
    return [...notes, ...cmds];
  }, [noteHits, groups]);

  // Reset state when opening/closing
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement | null;
      setQuery('');
      setNoteHits([]);
      setSelectedIndex(0);
      // Auto-focus input after portal renders
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (!isOpen) return;
    const needle = query.trim();
    let cancelled = false;
    const timer = window.setTimeout(
      () => {
        const req = needle
          ? window.dripnex.notes.search(needle, {
              limit: 8,
              isDeleted: false,
              excludeNotebookIds: ['templates'],
            })
          : window.dripnex.notes.list({
              limit: 8,
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
  }, [isOpen, query]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const active = listRef.current.querySelector('[data-active="true"]');
    if (active) {
      active.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const executeCommand = useCallback(
    (id: string) => {
      onClose();
      previousFocusRef.current?.focus();
      void dispatchCommand(id);
    },
    [onClose]
  );

  const openNote = useCallback(
    (id: string) => {
      onClose();
      previousFocusRef.current?.focus();
      onOpenNote?.(id);
    },
    [onClose, onOpenNote]
  );

  const executeItem = useCallback(
    (item: FlatItem | undefined) => {
      if (!item) return;
      if (item.type === 'note') openNote(item.id);
      else executeCommand(item.id);
    },
    [openNote, executeCommand]
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
          onClose();
          previousFocusRef.current?.focus();
          break;
        }
      }
    },
    [flatItems, selectedIndex, executeItem, onClose]
  );

  if (!isOpen) return null;

  // Build flat index counter for mapping group items to flat index
  let flatIndex = noteHits.length;

  return createPortal(
    <div
      className={sc('command-palette-overlay')}
      onClick={onClose}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-label="Command Palette"
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
            placeholder="Quick Open a note or run a command…"
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
          ) : (
            <>
              {noteHits.length > 0 ? (
                <div className={sc('command-palette-group')}>
                  <div className={sc('command-palette-group-label')}>
                    {query.trim() ? 'Notes' : 'Recent'}
                  </div>
                  {noteHits.map((note, noteIndex) => {
                    const isActive = noteIndex === selectedIndex;
                    return (
                      <div
                        key={note.id}
                        id={`cmd-note-${note.id}`}
                        className={sc(
                          'command-palette-item',
                          isActive && 'command-palette-item--active'
                        )}
                        role="option"
                        aria-selected={isActive}
                        data-active={isActive ? 'true' : undefined}
                        onClick={() => openNote(note.id)}
                        onMouseEnter={() => setSelectedIndex(noteIndex)}
                      >
                        <span className={sc('command-palette-item-icon')}>
                          <FileCode size={14} />
                        </span>
                        <span className={sc('command-palette-item-name')}>{note.title}</span>
                        <span className={sc('command-palette-item-category')}>Note</span>
                      </div>
                    );
                  })}
                </div>
              ) : null}
              {groups.map(group => {
                const groupItems = group.commands.map(cmd => {
                  const currentFlatIndex = flatIndex++;
                  const isActive = currentFlatIndex === selectedIndex;
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
                      onMouseEnter={() => setSelectedIndex(currentFlatIndex)}
                    >
                      <span className={sc('command-palette-item-icon')}>
                        {IconComponent ? <IconComponent size={14} /> : null}
                      </span>
                      <span className={sc('command-palette-item-name')}>{cmd.name}</span>
                      <span className={sc('command-palette-item-category')}>{group.label}</span>
                      {kbLabel && <kbd className={sc('command-palette-item-kbd')}>{kbLabel}</kbd>}
                    </div>
                  );
                });

                return (
                  <div key={group.category} className={sc('command-palette-group')}>
                    <div className={sc('command-palette-group-label')}>{group.label}</div>
                    {groupItems}
                  </div>
                );
              })}
            </>
          )}
        </div>
        <LayoutZone name="command-palette-footer" />
      </div>
    </div>,
    document.body
  );
}
