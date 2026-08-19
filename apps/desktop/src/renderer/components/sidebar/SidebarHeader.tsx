import { Network, Settings } from 'lucide-react';
import { IconButton } from '../../ui/primitives';
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
        <IconButton label="Open graph" onClick={onOpenGraph}>
          <Network size={16} aria-hidden="true" />
        </IconButton>
      ) : null}
      <IconButton label="Settings" onClick={onSettingsClick}>
        <Settings size={16} aria-hidden="true" />
      </IconButton>
    </div>
  );
}
