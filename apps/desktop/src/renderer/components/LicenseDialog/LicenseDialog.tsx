import { useState, useCallback, type DragEvent } from 'react';
import { useLicense } from '../../contexts/LicenseContext';
import styles from './LicenseDialog.module.css';

export function LicenseDialog() {
  const { state, isDialogOpen, closeDialog, activateLicense, importLicense } = useLicense();
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isActivating, setIsActivating] = useState(false);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    async (e: DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      setError(null);

      const file = e.dataTransfer.files[0];
      if (!file || !file.name.endsWith('.json')) {
        setError('Please drop a .json license file');
        return;
      }

      setIsActivating(true);
      try {
        const content = await file.text();
        const result = await activateLicense(content);
        if (!result.success) {
          setError(result.error ?? 'Activation failed');
        }
      } catch {
        setError('Failed to read file');
      } finally {
        setIsActivating(false);
      }
    },
    [activateLicense]
  );

  const handleImportClick = useCallback(async () => {
    setError(null);
    setIsActivating(true);
    try {
      const result = await importLicense();
      if (!result.success && result.error !== 'Cancelled') {
        setError(result.error ?? 'Import failed');
      }
    } finally {
      setIsActivating(false);
    }
  }, [importLicense]);

  const handleBuyClick = useCallback(() => {
    window.open('https://readied.app/pricing', '_blank');
  }, []);

  if (!isDialogOpen) return null;

  const isLicensed = state?.status === 'licensed' || state?.status === 'updates_expired';

  const getStatusClass = () => {
    switch (state?.status) {
      case 'trial': return styles.statusTrial;
      case 'trial_expired': return styles.statusTrialExpired;
      case 'licensed': return styles.statusLicensed;
      case 'updates_expired': return styles.statusUpdatesExpired;
      default: return styles.status;
    }
  };

  return (
    <div className={styles.overlay} onClick={closeDialog}>
      <div className={styles.dialog} onClick={e => e.stopPropagation()}>
        <button className={styles.close} onClick={closeDialog} aria-label="Close">
          &times;
        </button>

        <h2 className={styles.title}>
          {isLicensed ? 'Your License' : 'Activate License'}
        </h2>

        {state && (
          <div className={styles.statusWrapper}>
            <span className={getStatusClass()}>
              {state.status === 'trial' && `Trial (${state.trialDaysRemaining} days left)`}
              {state.status === 'trial_expired' && 'Trial Expired'}
              {state.status === 'licensed' && 'Licensed'}
              {state.status === 'updates_expired' && 'Licensed (Updates Expired)'}
            </span>
          </div>
        )}

        {!isLicensed && (
          <>
            <div
              className={isDragging ? styles.dropzoneActive : styles.dropzone}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className={styles.dropzoneIcon}>
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <p className={styles.dropzoneText}>
                {isDragging ? 'Drop license file here' : 'Drag & drop your license.json here'}
              </p>
              <span className={styles.dropzoneOr}>or</span>
              <button
                className={styles.browseBtn}
                onClick={handleImportClick}
                disabled={isActivating}
              >
                {isActivating ? 'Activating...' : 'Browse for file'}
              </button>
            </div>

            {error && <p className={styles.error}>{error}</p>}

            <div className={styles.divider}>
              <span>No license yet?</span>
            </div>

            <button className={styles.buyBtn} onClick={handleBuyClick}>
              Buy License - $79
            </button>
            <p className={styles.note}>One-time payment. Own the app forever.</p>
          </>
        )}

        {isLicensed && state?.updatesUntil && (
          <div className={styles.info}>
            <p>
              Updates until: <strong>{new Date(state.updatesUntil).toLocaleDateString()}</strong>
            </p>
            {!state.hasUpdates && (
              <>
                <p className={styles.infoNote}>
                  Your app works forever, but you won't receive new features.
                </p>
                <button className={styles.renewBtn} onClick={handleBuyClick}>
                  Renew Updates - $39/year
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
