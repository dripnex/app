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
  const enabled = useSettingsStore(s => s.settings.integrations?.mcpEnabled ?? false);
  const writes = useSettingsStore(s => s.settings.integrations?.mcpWrites ?? false);

  useEffect(() => {
    if (!hydrated) return;
    const api = window.dripnex?.localServer;
    if (!api) return;
    if (enabled) void api.start();
    else void api.stop();
  }, [hydrated, enabled]);

  useEffect(() => {
    if (!hydrated) return;
    const setWrites = window.dripnex?.localServer?.setWrites;
    if (!setWrites) return;
    void setWrites(writes);
  }, [hydrated, writes]);
}
