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
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { CommandCategory } from '@readied/command-registry';
import {
  useCommandRegistry,
  dispatchCommand,
  formatKeybinding,
  registry,
} from '../hooks/useCommandRegistry';
import { LayoutZone } from '@readied/plugin-api';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
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

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const commands = useCommandRegistry();
  const [query, setQuery] = useState('');
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

  // Flat list for keyboard navigation
  const flatItems = useMemo(() => {
    return groups.flatMap(g => g.commands);
  }, [groups]);

  // Reset state when opening/closing
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement | null;
      setQuery('');
      setSelectedIndex(0);
      // Auto-focus input after portal renders
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [isOpen]);

  // Reset selected index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

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
          const cmd = flatItems[selectedIndex];
          if (cmd) executeCommand(cmd.id);
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
    [flatItems, selectedIndex, executeCommand, onClose]
  );

  if (!isOpen) return null;

  // Build flat index counter for mapping group items to flat index
  let flatIndex = 0;

  return createPortal(
    <div
      className="command-palette-overlay"
      onClick={onClose}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-label="Command Palette"
      aria-modal="true"
    >
      <div className="command-palette" onClick={e => e.stopPropagation()}>
        <div className="command-palette-input-wrapper">
          <Search size={16} />
          <input
            ref={inputRef}
            className="command-palette-input"
            type="text"
            placeholder="Type a command..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            role="combobox"
            aria-expanded="true"
            aria-controls="command-palette-list"
            aria-activedescendant={
              flatItems[selectedIndex] ? `cmd-${flatItems[selectedIndex].id}` : undefined
            }
          />
        </div>

        <div
          ref={listRef}
          className="command-palette-list"
          id="command-palette-list"
          role="listbox"
        >
          {groups.length === 0 ? (
            <div className="command-palette-empty">No commands found</div>
          ) : (
            groups.map(group => {
              const groupItems = group.commands.map(cmd => {
                const currentFlatIndex = flatIndex++;
                const isActive = currentFlatIndex === selectedIndex;
                const IconComponent = cmd.icon ? ICON_MAP[cmd.icon] : undefined;
                const kb = registry.getKeybinding(cmd.id);
                const kbLabel = formatKeybinding(kb);

                return (
                  <div
                    key={cmd.id}
                    id={`cmd-${cmd.id}`}
                    className={`command-palette-item${isActive ? ' command-palette-item--active' : ''}`}
                    role="option"
                    aria-selected={isActive}
                    data-active={isActive ? 'true' : undefined}
                    onClick={() => executeCommand(cmd.id)}
                    onMouseEnter={() => setSelectedIndex(currentFlatIndex)}
                  >
                    <span className="command-palette-item-icon">
                      {IconComponent ? <IconComponent size={14} /> : null}
                    </span>
                    <span className="command-palette-item-name">{cmd.name}</span>
                    <span className="command-palette-item-category">{group.label}</span>
                    {kbLabel && (
                      <kbd className="command-palette-item-kbd">{kbLabel}</kbd>
                    )}
                  </div>
                );
              });

              return (
                <div key={group.category} className="command-palette-group">
                  <div className="command-palette-group-label">{group.label}</div>
                  {groupItems}
                </div>
              );
            })
          )}
        </div>
        <LayoutZone name="command-palette-footer" />
      </div>
    </div>,
    document.body
  );
}
