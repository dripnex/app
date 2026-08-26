/**
 * Hack — init.js, styles.css, keybindings.json in the data directory.
 */

import { useCallback } from 'react';
import { FileCode, Palette, Keyboard } from 'lucide';
import { Icon } from '../../../ui/icons/Icon';
import { Button, toast } from '../../../ui/primitives';
import { SettingGroup } from '../components/SettingGroup';
import { SettingRow } from '../components/SettingRow';
import { SettingsPage } from '../components/SettingsPage';
import { HACK_FILE_ACTIONS, type HackFileKind } from '../hackFiles';

const FILE_ICONS = {
  init: FileCode,
  styles: Palette,
  keymap: Keyboard,
} as const;

const FILE_NAMES: Record<HackFileKind, string> = {
  init: 'init.js',
  styles: 'styles.css',
  keymap: 'keybindings.json',
};

export function HackSection() {
  const handleOpenUserFile = useCallback(async (kind: HackFileKind) => {
    try {
      const result = await window.dripnex.plugins.openUserFile(kind);
      if (!result.success) {
        toast.error(result.error || `Failed to open ${FILE_NAMES[kind]}`);
        return;
      }
      if (kind === 'init') {
        window.dripnex.plugins.requestReload();
      }
    } catch (error) {
      toast.error(
        'Failed to open file: ' + (error instanceof Error ? error.message : 'Unknown error')
      );
    }
  }, []);

  return (
    <SettingsPage title="Hack" lede="These files live in the data directory. Save to apply.">
      <SettingGroup title="User files">
        {HACK_FILE_ACTIONS.map(action => (
          <SettingRow key={action.kind} label={action.label} description={action.description}>
            <Button
              variant="secondary"
              size="sm"
              icon={<Icon icon={FILE_ICONS[action.kind]} size={14} />}
              onClick={() => void handleOpenUserFile(action.kind)}
            >
              {action.button}
            </Button>
          </SettingRow>
        ))}
      </SettingGroup>
    </SettingsPage>
  );
}
