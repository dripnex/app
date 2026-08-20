/**
 * Live command chords + a door into keybindings.json.
 */

import { useEffect, useMemo, useState } from 'react';
import { Keyboard } from 'lucide-react';
import { formatKeybinding, parseKeymap, type CommandDefinition } from '@dripnex/command-registry';
import { editorCommands, appCommands, aiCommands } from '@dripnex/command-registry/definitions';
import { Button, toast } from '../../../ui/primitives';
import { SettingGroup } from '../components/SettingGroup';
import { SettingRow } from '../components/SettingRow';
import styles from './Section.module.css';
import keyStyles from './Keybindings.module.css';

const ALL_COMMANDS: CommandDefinition[] = [...editorCommands, ...appCommands, ...aiCommands];

export function KeybindingsSection() {
  const [overrides, setOverrides] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    void window.dripnex.plugins.readKeymap().then(source => {
      if (!source) return;
      const { overrides: parsed } = parseKeymap(source);
      const next = new Map<string, string>();
      for (const item of parsed) {
        next.set(item.commandId, item.keybinding ? formatKeybinding(item.keybinding) : 'unset');
      }
      setOverrides(next);
    });
  }, []);

  const rows = useMemo(
    () =>
      ALL_COMMANDS.filter(cmd => cmd.showInPalette !== false || cmd.defaultKeybinding).sort(
        (a, b) => a.name.localeCompare(b.name)
      ),
    []
  );

  const handleOpen = async () => {
    try {
      const result = await window.dripnex.plugins.openUserFile('keymap');
      if (!result.success) {
        toast.error(result.error || 'Failed to open keybindings.json');
      }
    } catch (error) {
      toast.error(
        'Failed to open file: ' + (error instanceof Error ? error.message : 'Unknown error')
      );
    }
  };

  return (
    <div className={styles.section}>
      <h2 className={styles.title}>Keybindings</h2>
      <p className={styles.lede}>
        Defaults for every command. Override a chord in keybindings.json — save the file and it
        applies immediately.
      </p>

      <SettingGroup title="File">
        <SettingRow
          label="Keymap"
          description="JSON of command id → chord. null unbinds the default."
        >
          <Button
            variant="secondary"
            size="sm"
            icon={<Keyboard size={14} />}
            onClick={() => void handleOpen()}
          >
            Open keybindings.json
          </Button>
        </SettingRow>
      </SettingGroup>

      <table className={keyStyles.table}>
        <thead>
          <tr>
            <th>Command</th>
            <th>Default</th>
            <th>Yours</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(cmd => {
            const override = overrides.get(cmd.id);
            return (
              <tr key={cmd.id}>
                <td>
                  <div className={keyStyles.name}>{cmd.name}</div>
                  <div className={keyStyles.id}>{cmd.id}</div>
                </td>
                <td className={keyStyles.chord}>
                  {cmd.defaultKeybinding ? formatKeybinding(cmd.defaultKeybinding) : '—'}
                </td>
                <td className={keyStyles.chord}>{override ?? '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
