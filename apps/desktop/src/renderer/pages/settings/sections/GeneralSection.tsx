/**
 * General Settings Section
 *
 * Default notebook, data folder access.
 */

import { useCallback } from 'react';
import { FolderOpen } from 'lucide-react';
import { useSettingsStore, selectGeneral } from '../../../stores/settings';
import { useNotebooks } from '../../../hooks/useNotebooks';
import { SettingGroup } from '../components/SettingGroup';
import { SettingRow } from '../components/SettingRow';
import { SettingSelect } from '../components/SettingSelect';
import { SettingToggle } from '../components/SettingToggle';
import { SettingsPage } from '../components/SettingsPage';
import { Button } from '../../../ui/primitives';

export function GeneralSection() {
  const general = useSettingsStore(selectGeneral);
  const updateGeneral = useSettingsStore(s => s.updateGeneral);
  const { data: notebooks = [] } = useNotebooks();

  // Build notebook options for dropdown
  const notebookOptions = [
    { value: '', label: 'Inbox' },
    ...notebooks.map(nb => ({
      value: nb.id,
      label: nb.name,
    })),
  ];

  // Ensure "Inbox" is always available
  if (!notebookOptions.find(o => o.value === 'inbox')) {
    notebookOptions.splice(1, 0, { value: 'inbox', label: 'Inbox' });
  }

  const handleOpenDataFolder = useCallback(async () => {
    await window.dripnex.data.openFolder();
  }, []);

  return (
    <SettingsPage title="General">
      <SettingGroup title="Notes">
        <SettingSelect
          label="Default Notebook"
          description="New notes will be created in this notebook"
          htmlFor="defaultNotebook"
          value={general.defaultNotebookId || ''}
          onChange={value => updateGeneral({ defaultNotebookId: value || '' })}
          options={notebookOptions}
        />
      </SettingGroup>

      <SettingGroup title="Window">
        <SettingToggle
          label="Remember Window Position"
          description="Restore window size and position on startup"
          htmlFor="rememberWindowPosition"
          checked={general.rememberWindowPosition}
          onChange={checked => updateGeneral({ rememberWindowPosition: checked })}
        />
      </SettingGroup>

      <SettingGroup title="Developer">
        <SettingToggle
          label="Development Mode"
          description="Right-click any element to inspect it. Reload is not required."
          htmlFor="developmentMode"
          checked={general.developmentMode ?? false}
          onChange={checked => updateGeneral({ developmentMode: checked })}
        />
      </SettingGroup>

      <SettingGroup title="Data">
        <SettingRow
          label="Open Data Folder"
          description="Open the folder containing your notes database"
        >
          <Button
            variant="secondary"
            size="sm"
            icon={<FolderOpen size={14} />}
            onClick={handleOpenDataFolder}
          >
            Open Folder
          </Button>
        </SettingRow>
      </SettingGroup>
    </SettingsPage>
  );
}
