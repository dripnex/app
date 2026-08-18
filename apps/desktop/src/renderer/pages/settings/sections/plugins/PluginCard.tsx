/**
 * PluginCard — Individual plugin card with toggle, config, and uninstall.
 */

import { useState } from 'react';
import { ChevronDown, Trash2 } from 'lucide-react';
import type { PluginConfigSchemaField } from '../../../../../preload/index';
import { Input, NumberInput, Select, Toggle } from '../../../../ui/primitives';
import { RangeInput } from '../../components/controls';
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
    <div className={styles.pluginCard}>
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
        <div className={styles.pluginCardControl}>
          <Toggle
            id={`plugin-${name.toLowerCase().replace(/\s+/g, '-')}`}
            checked={enabled}
            onChange={checked => onToggle?.(checked)}
          />
          {!isBuiltIn && onUninstall && (
            <button
              type="button"
              className={styles.pluginUninstallButton}
              onClick={onUninstall}
              title="Uninstall plugin"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {hasConfig && (
        <>
          <button
            type="button"
            className={`${styles.pluginConfigToggle} ${configOpen ? styles.pluginConfigToggleOpen : ''}`}
            onClick={() => setConfigOpen(prev => !prev)}
          >
            <ChevronDown size={14} />
            <span>Settings</span>
          </button>

          {configOpen && (
            <div className={styles.pluginConfigPanel}>
              {Object.entries(configSchema).map(([key, field]) => {
                const value = getConfigValue(key, field);
                const fieldId = `plugin-config-${name}-${key}`;
                const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());

                return (
                  <div key={key} className={styles.pluginConfigRow}>
                    <div>
                      <div className={styles.pluginConfigLabel}>{label}</div>
                      {field.description && (
                        <div className={styles.pluginConfigDescription}>{field.description}</div>
                      )}
                    </div>
                    <div>
                      {field.type === 'boolean' && (
                        <Toggle
                          id={fieldId}
                          checked={value as boolean}
                          onChange={checked => onConfigChange?.(key, checked)}
                        />
                      )}
                      {field.type === 'string' && (
                        <Input
                          id={fieldId}
                          value={(value as string) ?? ''}
                          onChange={event => onConfigChange?.(key, event.target.value)}
                        />
                      )}
                      {field.type === 'number' && (
                        <NumberInput
                          id={fieldId}
                          value={(value as number) ?? 0}
                          onChange={v => onConfigChange?.(key, v)}
                        />
                      )}
                      {field.type === 'enum' && field.options && (
                        <Select
                          id={fieldId}
                          value={(value as string) ?? ''}
                          onChange={v => onConfigChange?.(key, v)}
                          options={field.options}
                        />
                      )}
                      {field.type === 'range' && (
                        <RangeInput
                          id={fieldId}
                          value={(value as number) ?? field.min ?? 0}
                          onChange={v => onConfigChange?.(key, v)}
                          min={field.min ?? 0}
                          max={field.max ?? 100}
                          step={field.step}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
