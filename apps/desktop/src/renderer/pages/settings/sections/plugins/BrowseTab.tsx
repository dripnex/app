/**
 * Browse the Dripnex plugin registry — one card, one Install click.
 * Same idea as Inkdrop Preferences → Install: the registry is the index,
 * the package name is the install key, the tarball is the artifact.
 */

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Button, toast } from '../../../../ui/primitives';
import { SettingsCard } from '../../components/SettingsCard';
import {
  COMMUNITY_CATALOG,
  cardsFromRegistry,
  installTargetFor,
  mergeFallbackCatalog,
  type CatalogCard,
} from './communityCatalog';
import styles from './Plugins.module.css';

export function BrowseTab() {
  const [spec, setSpec] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [installed, setInstalled] = useState<Set<string>>(new Set());
  const [catalog, setCatalog] = useState<CatalogCard[]>(
    mergeFallbackCatalog([], COMMUNITY_CATALOG)
  );
  const [source, setSource] = useState<'registry' | 'fallback'>('fallback');

  const refreshInstalled = useCallback(async () => {
    try {
      const scanned = await window.dripnex.plugins.scan();
      setInstalled(new Set(scanned.map(p => p.id)));
    } catch {
      setInstalled(new Set());
    }
  }, []);

  useEffect(() => {
    void refreshInstalled();
    const onRefresh = () => void refreshInstalled();
    window.addEventListener('dripnex:plugins:refresh', onRefresh);
    return () => window.removeEventListener('dripnex:plugins:refresh', onRefresh);
  }, [refreshInstalled]);

  useEffect(() => {
    if (!window.dripnex.plugins.listRegistry) return;
    void window.dripnex.plugins
      .listRegistry()
      .then(result => {
        if (result.plugins.length === 0) return;
        setSource(result.source);
        setCatalog(mergeFallbackCatalog(cardsFromRegistry(result.plugins)));
      })
      .catch(() => {
        // Keep the bundled fallback. A failed GET must not blank Browse.
      });
  }, []);

  const install = useCallback(
    async (name: string, pluginId?: string) => {
      setBusyId(pluginId ?? name);
      setError(null);
      try {
        const result = await window.dripnex.plugins.installFromSpec(name);
        if (result.success) {
          toast.success(`Installed ${result.pluginName ?? result.pluginId ?? name}`);
          window.dripnex.plugins.requestReload();
          window.dispatchEvent(new CustomEvent('dripnex:plugins:refresh'));
          await refreshInstalled();
          return true;
        }
        setError(result.error ?? 'Install failed');
        return false;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Install failed');
        return false;
      } finally {
        setBusyId(null);
      }
    },
    [refreshInstalled]
  );

  const connect = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      const value = spec.trim();
      if (!value || busyId) return;
      const ok = await install(value);
      if (ok) setSpec('');
    },
    [spec, busyId, install]
  );

  return (
    <div className={styles.pluginConnect}>
      <h3 className={styles.pluginConnectTitle}>Registry</h3>
      <p className={styles.pluginConnectCopy}>
        Click Install. Official packs download their GitHub release tarball — same as{' '}
        <code>dripnex-plugin install owner/repo</code>.
        {source === 'fallback'
          ? ' Showing the first-party catalog until the API is reachable.'
          : null}
      </p>

      <div className={styles.pluginCardList}>
        {catalog.map(plugin => {
          const isInstalled = installed.has(plugin.slug);
          const busy = busyId === plugin.slug;
          return (
            <SettingsCard key={plugin.slug} flush>
              <div className={styles.pluginCardHeader}>
                <div className={styles.pluginCardInfo}>
                  <div className={styles.pluginCardMeta}>
                    <span className={styles.pluginName}>{plugin.name}</span>
                    <span className={styles.pluginVersion}>v{plugin.version}</span>
                  </div>
                  <p className={styles.pluginDescription}>{plugin.description}</p>
                  <p className={styles.pluginConnectHint}>
                    {plugin.repository ? (
                      <a
                        href={`https://github.com/${plugin.repository}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {plugin.repository}
                      </a>
                    ) : (
                      <code>{plugin.slug}</code>
                    )}
                  </p>
                </div>
                <div className={styles.pluginCardControl}>
                  {isInstalled ? (
                    <span className={styles.pluginMarketplaceIncluded}>Installed</span>
                  ) : (
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={busyId !== null}
                      onClick={() => void install(installTargetFor(plugin), plugin.slug)}
                    >
                      {busy ? 'Installing…' : 'Install'}
                    </Button>
                  )}
                </div>
              </div>
            </SettingsCard>
          );
        })}
      </div>

      <h3 className={styles.pluginConnectTitle} style={{ marginTop: '1.5rem' }}>
        Other package
      </h3>
      <p className={styles.pluginConnectCopy}>
        Name from the registry (<code>stamp</code>), or a repo not listed yet (
        <code>owner/repo</code>).
      </p>

      <form className={styles.pluginConnectForm} onSubmit={e => void connect(e)}>
        <input
          type="text"
          className={styles.pluginSearchInput}
          placeholder="stamp  or  owner/repo@v1.2.3"
          value={spec}
          onChange={e => setSpec(e.target.value)}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Package name or repository"
          disabled={busyId !== null}
        />
        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={busyId !== null || !spec.trim()}
        >
          Install
        </Button>
      </form>

      {error ? (
        <p className={styles.pluginConnectError} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
