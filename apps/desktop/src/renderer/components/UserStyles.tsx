import { useEffect } from 'react';

const STYLE_ID = 'dripnex-user-styles';

/**
 * Injects the user stylesheet (styles.css in the data directory).
 * Re-reads when the file changes or plugins reload.
 */
export function UserStyles() {
  useEffect(() => {
    const plugins = window.dripnex?.plugins;
    if (!plugins?.readUserStyles) return;

    let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      document.head.appendChild(style);
    }

    const apply = async () => {
      try {
        const css = await plugins.readUserStyles();
        style!.textContent = css ?? '';
      } catch {
        style!.textContent = '';
      }
    };

    void apply();
    const offStyles = window.dripnex.ipc.on('plugins:userStylesChanged', () => {
      void apply();
    });
    const offReload = window.dripnex.ipc.on('plugins:reload', () => {
      void apply();
    });

    return () => {
      offStyles();
      offReload();
    };
  }, []);

  return null;
}
