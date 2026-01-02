import { Settings } from 'lucide-react';

interface SidebarHeaderProps {
  readonly onSettingsClick?: () => void;
}

export function SidebarHeader({ onSettingsClick }: SidebarHeaderProps) {
  if (!onSettingsClick) return null;

  return (
    <div className="sidebar-header">
      <button
        type="button"
        className="sidebar-settings-btn"
        onClick={onSettingsClick}
        aria-label="Settings"
      >
        <Settings size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
