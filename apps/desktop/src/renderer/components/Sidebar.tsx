interface SidebarProps {
  onNewNote: () => void
}

export function Sidebar({ onNewNote }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1 className="sidebar-title">Readied</h1>
      </div>
      <nav className="sidebar-nav">
        <button className="sidebar-button" onClick={onNewNote}>
          <span className="icon">+</span>
          New Note
        </button>
      </nav>
      <div className="sidebar-footer">
        <span className="version">v{window.readied.app.version()}</span>
      </div>
    </aside>
  )
}
