import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, Plus, Search, X } from 'lucide';
import { Icon } from '../../ui/icons/Icon';
import { sc } from './sc';

interface SidebarSectionProps {
  readonly title: string;
  readonly children: ReactNode;
  readonly collapsible?: boolean;
  readonly defaultCollapsed?: boolean;
  readonly onAdd?: () => void;
  readonly addLabel?: string;
  readonly searchable?: boolean;
  readonly searchQuery?: string;
  readonly onSearchChange?: (query: string) => void;
  readonly searchPlaceholder?: string;
}

export function SidebarSection({
  title,
  children,
  collapsible = false,
  defaultCollapsed = false,
  onAdd,
  addLabel = 'Add',
  searchable = false,
  searchQuery = '',
  onSearchChange,
  searchPlaceholder = 'Filter…',
}: SidebarSectionProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [searchOpen, setSearchOpen] = useState(false);

  const handleToggle = () => {
    if (collapsible) setIsCollapsed(prev => !prev);
  };

  return (
    <section className={sc('sidebar-section')} aria-label={title}>
      <header className={sc('sidebar-section-header')}>
        {searchOpen && searchable ? (
          <div className={sc('sidebar-section-search')}>
            <Icon icon={Search} size={12} aria-hidden="true" />
            <input
              type="search"
              className={sc('sidebar-section-search-input')}
              value={searchQuery}
              onChange={e => onSearchChange?.(e.target.value)}
              placeholder={searchPlaceholder}
              autoFocus
              aria-label={`Filter ${title}`}
            />
            <button
              type="button"
              className={sc('sidebar-section-icon-btn')}
              onClick={() => {
                setSearchOpen(false);
                onSearchChange?.('');
              }}
              aria-label="Close search"
            >
              <Icon icon={X} size={12} />
            </button>
          </div>
        ) : (
          <>
            <span className={sc('sidebar-section-title')}>{title}</span>
            <div className={sc('sidebar-section-actions')}>
              {searchable && (
                <button
                  type="button"
                  className={sc('sidebar-section-icon-btn')}
                  onClick={() => {
                    setIsCollapsed(false);
                    setSearchOpen(true);
                  }}
                  aria-label={`Search ${title}`}
                >
                  <Icon icon={Search} size={13} />
                </button>
              )}
              {onAdd && (
                <button
                  type="button"
                  className={sc('sidebar-section-icon-btn')}
                  onClick={onAdd}
                  aria-label={addLabel}
                >
                  <Icon icon={Plus} size={13} />
                </button>
              )}
              {collapsible && (
                <button
                  type="button"
                  className={sc('sidebar-section-icon-btn', !isCollapsed && 'is-open')}
                  onClick={handleToggle}
                  aria-expanded={!isCollapsed}
                  aria-label={isCollapsed ? `Expand ${title}` : `Collapse ${title}`}
                >
                  <Icon icon={isCollapsed ? ChevronRight : ChevronDown} size={14} />
                </button>
              )}
            </div>
          </>
        )}
      </header>
      <div className={sc('sidebar-section-body', isCollapsed && 'is-collapsed')}>
        <div className={sc('sidebar-section-content')}>{children}</div>
      </div>
    </section>
  );
}
