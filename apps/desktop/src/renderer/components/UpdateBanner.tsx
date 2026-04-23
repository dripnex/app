import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import styles from './UpdateBanner.module.css';

type BannerState =
  | { kind: 'hidden' }
  | { kind: 'available'; version: string }
  | { kind: 'downloading'; version: string; percent: number }
  | { kind: 'ready'; version: string }
  | { kind: 'error'; version: string; message?: string };

export function UpdateBanner() {
  const [state, setState] = useState<BannerState>({ kind: 'hidden' });
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const cleanups: Array<() => void> = [];

    cleanups.push(
      window.readied.updates.onAvailable(info => {
        setState({ kind: 'available', version: info.version });
        setDismissed(false);
      })
    );

    cleanups.push(
      window.readied.updates.onDownloadProgress(p => {
        setState(prev =>
          prev.kind === 'hidden'
            ? prev
            : {
                kind: 'downloading',
                version: (prev as { version: string }).version,
                percent: Math.round(p.percent),
              }
        );
      })
    );

    cleanups.push(
      window.readied.updates.onDownloadComplete(info => {
        setState({ kind: 'ready', version: info.version });
        setDismissed(false);
      })
    );

    cleanups.push(
      window.readied.updates.onError((err: { message?: string }) => {
        setState(prev =>
          prev.kind === 'hidden'
            ? prev
            : {
                kind: 'error',
                version: (prev as { version: string }).version,
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
      const result = await window.readied.updates.startDownload();
      if (!result.ok) {
        setState(prev =>
          prev.kind === 'hidden'
            ? prev
            : {
                kind: 'error',
                version: (prev as { version: string }).version,
                message: result.error ?? 'Download failed',
              }
        );
      }
    } catch (err) {
      setState(prev =>
        prev.kind === 'hidden'
          ? prev
          : {
              kind: 'error',
              version: (prev as { version: string }).version,
              message: err instanceof Error ? err.message : undefined,
            }
      );
    }
  }, []);

  const handleInstall = useCallback(() => {
    void window.readied.updates.installNow();
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
      {state.kind === 'error' && (
        <>
          <span className={styles.text}>
            Download failed{state.message ? `: ${state.message}` : ''}
          </span>
          <button className={styles.action} onClick={handleDownload}>
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
        <X size={14} />
      </button>
    </div>
  );
}
