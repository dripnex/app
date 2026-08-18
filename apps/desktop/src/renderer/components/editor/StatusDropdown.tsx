import { useState, useRef, useEffect, memo } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import type { NoteStatus } from '../../../preload/index';
import { useDropdownPosition } from '../../hooks/useDropdownPosition';
import { StatusGlyph } from '../sidebar/StatusGlyph';
import { sc } from './sc';

interface StatusDropdownProps {
  readonly status: NoteStatus;
  readonly onStatusChange: (status: NoteStatus) => void;
}

const statusConfig: Record<NoteStatus, { label: string }> = {
  active: { label: 'Active' },
  on_hold: { label: 'On Hold' },
  completed: { label: 'Completed' },
  dropped: { label: 'Dropped' },
};

const statuses: NoteStatus[] = ['active', 'on_hold', 'completed', 'dropped'];

export const StatusDropdown = memo(function StatusDropdown({
  status,
  onStatusChange,
}: StatusDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const currentConfig = statusConfig[status];

  // Auto-position dropdown to avoid viewport overflow
  const menuPosition = useDropdownPosition({
    triggerRef,
    menuRef,
    isOpen,
  });

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleSelect = (newStatus: NoteStatus) => {
    if (newStatus !== status) {
      onStatusChange(newStatus);
    }
    setIsOpen(false);
  };

  return (
    <div className={sc('editor-header-dropdown')} ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        className={sc('editor-header-dropdown-btn', 'status-dropdown-btn')}
        data-status={status}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={`Status: ${currentConfig.label}`}
      >
        <span className={sc('status-icon')}>
          <StatusGlyph status={status} />
        </span>
        <span>{currentConfig.label}</span>
        <ChevronDown size={12} className={sc('chevron-icon')} />
      </button>

      {isOpen && (
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
          {statuses.map(s => {
            const config = statusConfig[s];
            return (
              <button
                key={s}
                type="button"
                role="menuitem"
                className={sc('editor-header-menu-item', s === status && 'selected')}
                data-status={s}
                onClick={() => handleSelect(s)}
              >
                <span className={sc('item-icon')}>
                  <StatusGlyph status={s} />
                </span>
                <span className={sc('item-label')}>{config.label}</span>
                {s === status && (
                  <span className={sc('item-check')}>
                    <Check size={14} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
});
