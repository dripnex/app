/**
 * Community plugins whose installed version is behind the registry.
 */

import { useCallback, useEffect, useState } from 'react';
import { Button, toast } from '../../../../ui/primitives';
import { COMMUNITY_CATALOG, installSpecFor } from './communityCatalog';
import { versionNewer } from './version';
import styles from './Plugins.module.css';

interface OutdatedPlugin {
  id: string;
  name: string;
  installed: string;
  latest: string;
  spec: string;
}

export function UpdatesTab() {
  const [rows, setRows] = useState<OutdatedPlugin[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [scanned, registry] = await Promise.all([
        window.dripnex.plugins.scan(),
        window.dripnex.plugins.listRegistry(),
      ]);
      const bySlug = new Map(registry.plugins.map(p => [p.slug, p]));
      const fallbackById = new Map(COMMUNITY_CATALOG.map(p => [p.id, p]));
      const next: OutdatedPlugin[] = [];
      for (const plugin of scanned) {
        const remote = bySlug.get(plugin.id);
        const fallback = fallbackById.get(plugin.id);
        const latest = remote?.version ?? fallback?.version;
        if (!latest || !versionNewer(latest, plugin.version)) continue;
        const repository = remote?.repositoryUrl
          ? remote.repositoryUrl.replace(/^https:\/\/github\.com\//, '')
          : (fallback?.repository ?? null);
        next.push({
          id: plugin.id,
          name: plugin.name,
          installed: plugin.version,
          latest,
          spec: installSpecFor({ slug: remote?.slug ?? plugin.id, repository }),
        });
      }
      setRows(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check plugin updates');
      setRows([]);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onRefresh = () => void refresh();
    window.addEventListener('dripnex:plugins:refresh', onRefresh);
    return () => window.removeEventListener('dripnex:plugins:refresh', onRefresh);
  }, [refresh]);

  const update = async (row: OutdatedPlugin) => {
    setBusyId(row.id);
    try {
      const result = await window.dripnex.plugins.installFromSpec(row.spec);
      if (result.success) {
        toast.success(`Updated ${row.name} to ${row.latest}`);
        window.dripnex.plugins.requestReload();
        window.dispatchEvent(new CustomEvent('dripnex:plugins:refresh'));
        await refresh();
      } else {
        toast.error(result.error || 'Update failed');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setBusyId(null);
    }
  };

  if (rows === null) {
    return <p className={styles.pluginEmptyState}>Checking the registry…</p>;
  }

  if (error) {
    return <p className={styles.pluginEmptyState}>{error}</p>;
  }

  if (rows.length === 0) {
    return (
      <div className={styles.pluginEmptyState}>
        <p>Every community plugin is up to date. Built-ins ship with the app.</p>
      </div>
    );
  }

  return (
    <div className={styles.pluginCardList}>
      {rows.map(row => (
        <div key={row.id} className={styles.pluginCard}>
          <div className={styles.pluginCardHeader}>
            <div className={styles.pluginCardInfo}>
              <div className={styles.pluginCardMeta}>
                <span className={styles.pluginName}>{row.name}</span>
                <span className={styles.pluginVersion}>
                  v{row.installed} → v{row.latest}
                </span>
              </div>
            </div>
            <div className={styles.pluginCardControl}>
              <Button
                variant="secondary"
                size="sm"
                disabled={busyId === row.id}
                loading={busyId === row.id}
                onClick={() => void update(row)}
              >
                {busyId === row.id ? 'Updating…' : 'Update'}
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
