/**
 * PluginCard — Individual plugin card with toggle, config, and uninstall.
 */

import { useState } from 'react';
import { ChevronDown, Trash2 } from 'lucide';
import { Icon } from '../../../../ui/icons/Icon';
import type { PluginConfigSchemaField } from '../../../../../preload/index';
import { RangeInput } from '../../components/controls';
import { SettingNumber } from '../../components/SettingNumber';
import { SettingSelect } from '../../components/SettingSelect';
import { SettingText } from '../../components/SettingText';
import { SettingToggle } from '../../components/SettingToggle';
import { SettingsCard } from '../../components/SettingsCard';
import { SettingRow } from '../../components/SettingRow';
import styles from './Plugins.module.css';

export interface PluginCardProps {
  name: string;
  version: string;
  description?: string;
  isBuiltIn: boolean;
  enabled: boolean;
  onToggle?: (enabled: boolean) => void;
  onUninstall?: () => void;
  configSchema?: Record<string, PluginConfigSchemaField>;
  configValues?: Record<string, unknown>;
  onConfigChange?: (key: string, value: unknown) => void;
}

export function PluginCard({
  name,
  version,
  description,
  isBuiltIn,
  enabled,
  onToggle,
  onUninstall,
  configSchema,
  configValues,
  onConfigChange,
}: PluginCardProps) {
  const [configOpen, setConfigOpen] = useState(false);
  const hasConfig = configSchema && Object.keys(configSchema).length > 0 && enabled;

  const getConfigValue = (key: string, field: PluginConfigSchemaField) => {
    const stored = configValues?.[key];
    return stored !== undefined ? stored : field.default;
  };

  return (
    <SettingsCard flush>
      <div className={styles.pluginCardHeader}>
        <div className={styles.pluginCardInfo}>
          <div className={styles.pluginCardMeta}>
            <span className={`${styles.pluginBadge} ${isBuiltIn ? styles.pluginBadgeBuiltIn : ''}`}>
              {isBuiltIn ? 'Built-in' : 'Installed'}
            </span>
            <span className={styles.pluginName}>{name}</span>
            <span className={styles.pluginVersion}>v{version}</span>
          </div>
          {description && <p className={styles.pluginDescription}>{description}</p>}
        </div>
        {!isBuiltIn && onUninstall ? (
          <button
            type="button"
            className={styles.pluginUninstallButton}
            onClick={onUninstall}
            title="Uninstall plugin"
          >
            <Icon icon={Trash2} size={14} />
          </button>
        ) : null}
      </div>
      <SettingToggle
        flush
        label="Enabled"
        description="Load this plugin when the app starts."
        htmlFor={`plugin-${name.toLowerCase().replace(/\s+/g, '-')}`}
        checked={enabled}
        onChange={checked => onToggle?.(checked)}
      />

      {hasConfig && (
        <>
          <button
            type="button"
            className={`${styles.pluginConfigToggle} ${configOpen ? styles.pluginConfigToggleOpen : ''}`}
            onClick={() => setConfigOpen(prev => !prev)}
          >
            <Icon icon={ChevronDown} size={14} />
            <span>Settings</span>
          </button>

          {configOpen && (
            <div className={styles.pluginConfigPanel}>
              {Object.entries(configSchema).map(([key, field]) => {
                const value = getConfigValue(key, field);
                const fieldId = `plugin-config-${name}-${key}`;
                const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());

                return (
                  <div key={key}>
                    {field.type === 'boolean' ? (
                      <SettingToggle
                        flush
                        label={label}
                        description={field.description}
                        htmlFor={fieldId}
                        checked={value as boolean}
                        onChange={checked => onConfigChange?.(key, checked)}
                      />
                    ) : null}
                    {field.type === 'string' ? (
                      <SettingText
                        flush
                        label={label}
                        description={field.description}
                        htmlFor={fieldId}
                        value={(value as string) ?? ''}
                        onChange={next => onConfigChange?.(key, next)}
                      />
                    ) : null}
                    {field.type === 'number' ? (
                      <SettingNumber
                        flush
                        label={label}
                        description={field.description}
                        htmlFor={fieldId}
                        value={(value as number) ?? 0}
                        onChange={next => onConfigChange?.(key, next)}
                      />
                    ) : null}
                    {field.type === 'enum' && field.options ? (
                      <SettingSelect
                        flush
                        label={label}
                        description={field.description}
                        htmlFor={fieldId}
                        value={(value as string) ?? ''}
                        onChange={next => onConfigChange?.(key, next)}
                        options={field.options}
                      />
                    ) : null}
                    {field.type === 'range' ? (
                      <SettingRow
                        flush
                        label={label}
                        description={field.description}
                        htmlFor={fieldId}
                      >
                        <RangeInput
                          id={fieldId}
                          value={(value as number) ?? field.min ?? 0}
                          onChange={v => onConfigChange?.(key, v)}
                          min={field.min ?? 0}
                          max={field.max ?? 100}
                          step={field.step}
                        />
                      </SettingRow>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </SettingsCard>
  );
}
