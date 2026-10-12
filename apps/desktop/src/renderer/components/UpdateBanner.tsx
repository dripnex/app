import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide';
import { Icon } from '../ui/icons/Icon';
import styles from './UpdateBanner.module.css';
import { updaterBannerErrorKind } from './updateBannerState';

type BannerState =
  | { kind: 'hidden' }
  | { kind: 'available'; version: string }
  | { kind: 'downloading'; version: string; percent: number }
  | { kind: 'ready'; version: string }
  | { kind: 'download-error'; version: string; message?: string }
  | { kind: 'install-error'; version: string; message?: string };

function versionOf(state: BannerState): string {
  return 'version' in state ? state.version : '';
}

export function UpdateBanner() {
  const [state, setState] = useState<BannerState>({ kind: 'hidden' });
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const cleanups: Array<() => void> = [];

    cleanups.push(
      window.dripnex.updates.onAvailable(info => {
        setState({ kind: 'available', version: info.version });
        setDismissed(false);
      })
    );

    cleanups.push(
      window.dripnex.updates.onDownloadProgress(p => {
        setState(prev =>
          prev.kind === 'hidden'
            ? prev
            : {
                kind: 'downloading',
                version: versionOf(prev),
                percent: Math.round(p.percent),
              }
        );
      })
    );

    cleanups.push(
      window.dripnex.updates.onDownloadComplete(info => {
        setState({ kind: 'ready', version: info.version });
        setDismissed(false);
      })
    );

    cleanups.push(
      window.dripnex.updates.onError((err: { message?: string }) => {
        setState(prev =>
          prev.kind === 'hidden'
            ? prev
            : {
                kind: updaterBannerErrorKind(prev.kind),
                version: versionOf(prev),
                message: err?.message,
              }
        );
        setDismissed(false);
      })
    );

    return () => cleanups.forEach(fn => fn());
  }, []);

  const handleDownload = useCallback(async () => {
    try {
      const result = await window.dripnex.updates.startDownload();
      if (!result.ok) {
        setState(prev =>
          prev.kind === 'hidden'
            ? prev
            : {
                kind: 'download-error',
                version: versionOf(prev),
                message: result.error ?? 'Download failed',
              }
        );
      }
    } catch (err) {
      setState(prev =>
        prev.kind === 'hidden'
          ? prev
          : {
              kind: 'download-error',
              version: versionOf(prev),
              message: err instanceof Error ? err.message : undefined,
            }
      );
    }
  }, []);

  const handleInstall = useCallback(() => {
    void window.dripnex.updates
      .installNow()
      .then(result => {
        if (result && result.ok === false) {
          setState(prev =>
            prev.kind === 'hidden'
              ? prev
              : {
                  kind: 'install-error',
                  version: versionOf(prev),
                  message: result.error,
                }
          );
        }
      })
      .catch(() => {
        setState(prev =>
          prev.kind === 'hidden' ? prev : { kind: 'install-error', version: versionOf(prev) }
        );
      });
  }, []);

  if (state.kind === 'hidden' || dismissed) return null;

  return (
    <div className={styles.banner}>
      {state.kind === 'available' && (
        <>
          <span className={styles.text}>Update available: v{state.version}</span>
          <button className={styles.action} onClick={handleDownload}>
            Download
          </button>
        </>
      )}
      {state.kind === 'downloading' && (
        <span className={styles.text}>
          Downloading v{state.version}... {state.percent}%
        </span>
      )}
      {state.kind === 'download-error' && (
        <>
          <span className={styles.text}>
            Download failed{state.message ? `: ${state.message}` : ''}
          </span>
          <button className={styles.action} onClick={handleDownload}>
            Retry
          </button>
        </>
      )}
      {state.kind === 'install-error' && (
        <>
          <span className={styles.text}>
            Install failed{state.message ? `: ${state.message}` : ''}
          </span>
          <button className={styles.action} onClick={handleInstall}>
            Retry
          </button>
        </>
      )}
      {state.kind === 'ready' && (
        <>
          <span className={styles.text}>v{state.version} ready to install</span>
          <button className={styles.action} onClick={handleInstall}>
            Restart to Update
          </button>
        </>
      )}
      <button
        className={styles.dismiss}
        onClick={() => setDismissed(true)}
        aria-label="Dismiss update banner"
      >
        <Icon icon={X} size={14} />
      </button>
    </div>
  );
}
