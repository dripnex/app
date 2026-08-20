import { useEffect } from 'react';
import { useSettingsStore, selectAi } from '../../stores/settings';

/** Load the provider key from safeStorage into the in-memory settings store. */
export function useAiKeyHydration(): void {
  const provider = useSettingsStore(selectAi).provider;

  useEffect(() => {
    if (provider === 'ollama' || provider === 'dripnex') return;
    let cancelled = false;
    void (async () => {
      try {
        const key = await window.dripnex.ai.getKey(provider);
        if (!cancelled) {
          useSettingsStore.getState().updateAi({ apiKey: key ?? '' });
        }
      } catch {
        // Keychain locked — submit handler asks the user to set a key.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [provider]);
}
