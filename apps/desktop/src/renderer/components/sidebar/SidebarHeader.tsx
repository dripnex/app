import { Settings } from 'lucide-react';
import { SyncStatusIndicator } from '../sync/SyncStatusIndicator';

interface SidebarHeaderProps {
  readonly onSettingsClick: () => void;
}

export function SidebarHeader({ onSettingsClick }: SidebarHeaderProps) {
  return (
    <div className="sidebar-header">
      <SyncStatusIndicator />
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
