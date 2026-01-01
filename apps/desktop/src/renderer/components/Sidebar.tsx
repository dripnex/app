import { Plus } from 'lucide-react';
import { NotebookTree } from './NotebookTree';

interface SidebarProps {
  onNewNote: () => void;
  selectedNotebookId: string | null;
  onSelectNotebook: (id: string) => void;
}

export function Sidebar({ onNewNote, selectedNotebookId, onSelectNotebook }: SidebarProps) {
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
          <Plus size={16} aria-hidden="true" />
          New Note
        </button>
      </nav>

      <div className="sidebar-notebooks">
        <NotebookTree selectedNotebookId={selectedNotebookId} onSelectNotebook={onSelectNotebook} />
      </div>

      <div className="sidebar-footer">
        <span className="version" aria-label={`Version ${window.readied.app.version()}`}>
          v{window.readied.app.version()}
        </span>
      </div>
    </aside>
  );
}
