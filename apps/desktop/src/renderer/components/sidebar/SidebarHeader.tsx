import { Settings } from 'lucide-react';

export function SidebarHeader() {
  return (
    <div className="sidebar-header">
      <button type="button" className="sidebar-settings-btn" aria-label="Settings">
        <Settings size={18} aria-hidden="true" />
      </button>
    </div>
  );
}
