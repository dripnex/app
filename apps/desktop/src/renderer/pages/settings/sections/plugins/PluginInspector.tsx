/**
 * PluginInspector — Developer debug panel showing errors, timings, and status.
 */

import { useState, useCallback, useSyncExternalStore } from 'react';
import { RefreshCw, ChevronDown, AlertTriangle } from 'lucide';
import { Icon } from '../../../../ui/icons/Icon';
import { pluginRuntimeStore } from '../../../../stores/pluginRuntimeStore';
import { Button } from '../../../../ui/primitives';
import styles from './Plugins.module.css';

export function PluginInspector() {
  const [open, setOpen] = useState(false);

  const status = useSyncExternalStore(
    pluginRuntimeStore.subscribe,
    () => pluginRuntimeStore.getState().status
  );
  const errors = useSyncExternalStore(
    pluginRuntimeStore.subscribe,
    () => pluginRuntimeStore.getState().errors
  );
  const timings = useSyncExternalStore(
    pluginRuntimeStore.subscribe,
    () => pluginRuntimeStore.getState().timings
  );
  const pluginCount = useSyncExternalStore(
    pluginRuntimeStore.subscribe,
    () => pluginRuntimeStore.getState().plugins.length
  );

  const handleForceReload = useCallback(() => {
    window.dripnex.plugins.requestReload();
  }, []);

  return (
    <div className={styles.inspectorPanel}>
      <button
        type="button"
        className={styles.inspectorToggle}
        onClick={() => setOpen(prev => !prev)}
        aria-expanded={open}
        aria-controls="plugin-inspector-panel"
      >
        <Icon
          icon={ChevronDown}
          size={14}
          style={{
            transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
            transition: 'transform 0.15s',
          }}
        />
        <span>Developer</span>
        {errors.length > 0 && (
          <span className={styles.inspectorErrorBadge}>
            <Icon icon={AlertTriangle} size={12} />
            {errors.length}
          </span>
        )}
      </button>

      {open && (
        <div id="plugin-inspector-panel" role="region" className={styles.inspectorContent}>
          <div className={styles.inspectorRow}>
            <span className={styles.inspectorLabel}>Status</span>
            <span>{status === 'scanning' ? 'Scanning...' : `${pluginCount} loaded`}</span>
          </div>

          {timings.length > 0 && (
            <div className={styles.inspectorTimings}>
              <div className={styles.inspectorLabel}>Load times</div>
              <table className={styles.inspectorTable}>
                <thead>
                  <tr>
                    <th>Plugin</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {timings.map(t => (
                    <tr key={t.pluginId}>
                      <td>{t.pluginName}</td>
                      <td>{t.loadTimeMs < 1 ? '<1' : Math.round(t.loadTimeMs)}ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {errors.length > 0 && (
            <div className={styles.inspectorErrors}>
              <div className={styles.inspectorLabel}>Errors</div>
              {errors.map(err => (
                <div key={err.pluginId} className={styles.inspectorError}>
                  <strong>{err.pluginName}</strong>
                  <span>{err.reason}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: '0.75rem' }}>
            <Button
              variant="secondary"
              size="sm"
              icon={<Icon icon={RefreshCw} size={14} />}
              onClick={handleForceReload}
            >
              Force Reload All
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
