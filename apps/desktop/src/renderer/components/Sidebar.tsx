interface SidebarProps {
  onNewNote: () => void;
}

export function Sidebar({ onNewNote }: SidebarProps) {
  return (
    <aside className="sidebar" aria-label="Main sidebar">
      <div className="sidebar-header">
        <h1 className="sidebar-title">Readied</h1>
      </div>
      <nav className="sidebar-nav" aria-label="Main actions">
        <button
          type="button"
          className="sidebar-button"
          onClick={onNewNote}
          aria-label="Create new note (⌘N)"
        >
          <span className="icon" aria-hidden="true">
            +
          </span>
          New Note
        </button>
      </nav>
      <div className="sidebar-footer">
        <span className="version" aria-label={`Version ${window.readied.app.version()}`}>
          v{window.readied.app.version()}
        </span>
      </div>
    </aside>
  );
}
