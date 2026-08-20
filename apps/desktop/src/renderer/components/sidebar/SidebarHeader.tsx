import { Network, Settings, Settings2, Waypoints } from 'lucide';
import { Icon } from '../../ui/icons/Icon';
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
          <Icon icon={Network} hoverIcon={Waypoints} size={16} />
        </IconButton>
      ) : null}
      <IconButton label="Settings" onClick={onSettingsClick}>
        <Icon icon={Settings} hoverIcon={Settings2} size={16} />
      </IconButton>
    </div>
  );
}
