import { Network, Settings } from 'lucide-react';
import { SyncStatusIndicator } from '../sync/SyncStatusIndicator';
import { sc } from './sc';

interface SidebarHeaderProps {
  readonly onSettingsClick: () => void;
  readonly onOpenGraph?: () => void;
}

export function SidebarHeader({ onSettingsClick, onOpenGraph }: SidebarHeaderProps) {
  return (
    <div className={sc('sidebar-header')}>
      <SyncStatusIndicator />
      {onOpenGraph ? (
        <button
          type="button"
          className={sc('sidebar-settings-btn')}
          aria-label="Open graph"
          onClick={onOpenGraph}
        >
          <Network size={16} aria-hidden="true" />
        </button>
      ) : null}
      <button
        type="button"
        className={sc('sidebar-settings-btn')}
        aria-label="Settings"
        onClick={onSettingsClick}
      >
        <Settings size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
