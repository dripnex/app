import { Settings } from 'lucide-react';

interface SidebarHeaderProps {
  readonly onSettingsClick: () => void;
}

export function SidebarHeader({ onSettingsClick }: SidebarHeaderProps) {
  return (
    <div className="sidebar-header">
      <button
        type="button"
        className="sidebar-settings-btn"
        aria-label="Settings"
        onClick={onSettingsClick}
      >
        <Settings size={18} aria-hidden="true" />
      </button>
    </div>
  );
}
