import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';

interface SidebarSectionProps {
  readonly title: string;
  readonly children: ReactNode;
  readonly collapsible?: boolean;
  readonly defaultCollapsed?: boolean;
  readonly onAdd?: () => void;
  readonly addLabel?: string;
}

export function SidebarSection({
  title,
  children,
  collapsible = false,
  defaultCollapsed = false,
  onAdd,
  addLabel = 'Add',
}: SidebarSectionProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  const handleToggle = () => {
    if (collapsible) {
      setIsCollapsed(prev => !prev);
    }
  };

  return (
    <section className="sidebar-section" aria-label={title}>
      <header className="sidebar-section-header">
        <button
          type="button"
          className="sidebar-section-title-btn"
          onClick={handleToggle}
          aria-expanded={!isCollapsed}
          disabled={!collapsible}
        >
          {collapsible && (
            <span className="sidebar-section-chevron" aria-hidden="true">
              {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
            </span>
          )}
          <span className="sidebar-section-title">{title}</span>
        </button>
        {onAdd && !isCollapsed && (
          <button
            type="button"
            className="sidebar-section-add-btn"
            onClick={onAdd}
            aria-label={addLabel}
          >
            <Plus size={14} aria-hidden="true" />
          </button>
        )}
      </header>
      {!isCollapsed && <div className="sidebar-section-content">{children}</div>}
    </section>
  );
}
