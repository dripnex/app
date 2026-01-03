import { useState, useRef, useEffect, memo } from 'react';
import { Circle, CircleDot, CheckCircle2, XCircle, ChevronDown, Check } from 'lucide-react';
import type { NoteStatus } from '../../../preload/index';

interface StatusDropdownProps {
  readonly status: NoteStatus;
  readonly onStatusChange: (status: NoteStatus) => void;
}

const statusConfig: Record<NoteStatus, { label: string; icon: React.ReactNode }> = {
  active: { label: 'Active', icon: <Circle size={14} /> },
  on_hold: { label: 'On Hold', icon: <CircleDot size={14} /> },
  completed: { label: 'Completed', icon: <CheckCircle2 size={14} /> },
  dropped: { label: 'Dropped', icon: <XCircle size={14} /> },
};

const statuses: NoteStatus[] = ['active', 'on_hold', 'completed', 'dropped'];

export const StatusDropdown = memo(function StatusDropdown({
  status,
  onStatusChange,
}: StatusDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentConfig = statusConfig[status];

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
    <div className="editor-header-dropdown" ref={containerRef}>
      <button
        type="button"
        className="editor-header-dropdown-btn status-dropdown-btn"
        data-status={status}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={`Status: ${currentConfig.label}`}
      >
        <span className="status-icon">{currentConfig.icon}</span>
        <span>{currentConfig.label}</span>
        <ChevronDown size={12} className="chevron-icon" />
      </button>

      {isOpen && (
        <div className="editor-header-menu" role="menu">
          {statuses.map(s => {
            const config = statusConfig[s];
            return (
              <button
                key={s}
                type="button"
                role="menuitem"
                className={`editor-header-menu-item ${s === status ? 'selected' : ''}`}
                data-status={s}
                onClick={() => handleSelect(s)}
              >
                <span className="item-icon">{config.icon}</span>
                <span className="item-label">{config.label}</span>
                {s === status && (
                  <span className="item-check">
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
