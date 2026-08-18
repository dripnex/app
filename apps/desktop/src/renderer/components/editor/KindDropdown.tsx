import { useEffect, useRef, useState, memo } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { NOTE_KINDS, kindMeta, type NoteKind } from '../../lib/knowledge';
import { useDropdownPosition } from '../../hooks/useDropdownPosition';
import { sc } from './sc';

interface KindDropdownProps {
  readonly kind: NoteKind;
  readonly onChange: (kind: NoteKind) => void;
}

export const KindDropdown = memo(function KindDropdown({ kind, onChange }: KindDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const current = kindMeta(kind);

  const menuPosition = useDropdownPosition({
    triggerRef,
    menuRef,
    isOpen,
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  return (
    <div className={sc('editor-header-dropdown')} ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        className={sc('editor-header-dropdown-btn')}
        onClick={() => setIsOpen(open => !open)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={`Type: ${current.label}`}
      >
        <span
          aria-hidden
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: current.color,
            flexShrink: 0,
          }}
        />
        <span>{current.label}</span>
        <ChevronDown size={12} className={sc('chevron-icon')} />
      </button>

      {isOpen ? (
        <div
          ref={menuRef}
          className={sc('editor-header-menu')}
          role="menu"
          style={{
            top: menuPosition.top,
            bottom: menuPosition.bottom,
            left: menuPosition.left,
            right: menuPosition.right,
          }}
        >
          {NOTE_KINDS.map(item => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              className={sc('editor-header-menu-item', item.id === kind && 'selected')}
              onClick={() => {
                if (item.id !== kind) onChange(item.id);
                setIsOpen(false);
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: item.color,
                  flexShrink: 0,
                }}
              />
              <span className={sc('item-label')}>{item.label}</span>
              {item.id === kind ? (
                <span className={sc('item-check')}>
                  <Check size={14} />
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
});
