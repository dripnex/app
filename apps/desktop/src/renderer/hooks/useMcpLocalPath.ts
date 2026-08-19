import { useEffect, useState } from 'react';
import { useSettingsStore } from '../stores/settings';

function useSettingsHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() => {
    const persist = (useSettingsStore as { persist?: { hasHydrated: () => boolean } }).persist;
    return persist?.hasHydrated() ?? true;
  });

  useEffect(() => {
    const persist = (
      useSettingsStore as {
        persist?: {
          hasHydrated: () => boolean;
          onFinishHydration: (fn: () => void) => () => void;
        };
      }
    ).persist;
    if (!persist) {
      setHydrated(true);
      return;
    }
    if (persist.hasHydrated()) {
      setHydrated(true);
      return;
    }
    return persist.onFinishHydration(() => setHydrated(true));
  }, []);

  return hydrated;
}

/**
 * Start/stop the local HTTP path and persist the MCP writes sidecar
 * whenever Integrations settings change. Lives in the main window so a
 * Settings toggle still takes effect after the settings window closes.
 */
export function useMcpLocalPath(): void {
  const hydrated = useSettingsHydrated();
  const httpEnabled = useSettingsStore(s => s.settings.integrations?.httpApiEnabled ?? false);
  const enabled = useSettingsStore(s => s.settings.integrations?.mcpEnabled ?? false);
  const writes = useSettingsStore(s => s.settings.integrations?.mcpWrites ?? false);

  useEffect(() => {
    if (!hydrated) return;
    const api = window.dripnex?.localServer;
    if (!api?.setWrites) return;

    let cancelled = false;
    void (async () => {
      const result = await api.setWrites(writes);
      if (cancelled || !result.ok) return;
      if (httpEnabled || enabled) await api.start();
      else await api.stop();
    })();

    return () => {
      cancelled = true;
    };
  }, [hydrated, httpEnabled, enabled, writes]);
}
