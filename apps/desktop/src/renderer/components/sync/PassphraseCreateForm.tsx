import { useCallback, useMemo, useState } from 'react';
import { generatePassphrase, scorePassphrase, MIN_CUSTOM_SCORE } from '../../utils/passphrase';
import { downloadEmergencyKit, printEmergencyKit } from '../../utils/emergencyKit';
import { downloadOnePasswordCsv } from '../../utils/onePasswordCsv';
import { SaveToOnePasswordButton } from './SaveToOnePasswordButton';
import styles from './PassphraseCreateForm.module.css';

interface PassphraseCreateFormProps {
  passphrase: string;
  passphraseConfirm: string;
  onPassphraseChange: (value: string) => void;
  onConfirmChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  error?: string | null;
  submitLabel?: string;
  busy?: boolean;
  email?: string | null;
}

export function PassphraseCreateForm({
  passphrase,
  passphraseConfirm,
  onPassphraseChange,
  onConfirmChange,
  onSubmit,
  error,
  submitLabel = 'Create passphrase',
  busy = false,
  email,
}: PassphraseCreateFormProps) {
  const [mode, setMode] = useState<'generated' | 'custom'>('generated');
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const strength = useMemo(() => scorePassphrase(passphrase), [passphrase]);

  const regenerate = useCallback(() => {
    const next = generatePassphrase();
    onPassphraseChange(next);
    onConfirmChange(next);
    setSaved(false);
    setCopied(false);
  }, [onPassphraseChange, onConfirmChange]);

  const useGenerated = useCallback(() => {
    setMode('generated');
    regenerate();
  }, [regenerate]);

  const copyGenerated = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(passphrase);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard can fail in locked sessions
    }
  }, [passphrase]);

  const canSubmit =
    !busy &&
    passphrase === passphraseConfirm &&
    (mode === 'generated' ? saved && strength.ok : strength.ok);

  return (
    <form
      onSubmit={event => {
        event.preventDefault();
        if (!canSubmit) return;
        onSubmit(event);
      }}
      className={styles.form}
    >
      {/* Username + password fields so 1Password / Bitwarden can offer Save. */}
      <input
        type="email"
        name="username"
        autoComplete="username"
        value={email ?? ''}
        readOnly
        tabIndex={-1}
        aria-hidden="true"
        className={styles.srOnly}
      />
      {mode === 'generated' ? (
        <>
          <p className={styles.hint}>
            Six random words. Save them in 1Password or write them down — they are not stored here.
          </p>
          <div className={styles.generatedBox}>
            <input
              type="text"
              name="password"
              className={styles.generatedPhrase}
              autoComplete="new-password"
              readOnly
              value={passphrase}
              aria-label="Generated passphrase"
            />
            <div className={styles.generatedActions}>
              <button type="button" className={styles.ghost} onClick={regenerate}>
                New words
              </button>
              <button type="button" className={styles.ghost} onClick={() => void copyGenerated()}>
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <SaveToOnePasswordButton email={email} passphrase={passphrase} />
            <div className={styles.generatedActions}>
              <button
                type="button"
                className={styles.ghost}
                onClick={() => downloadOnePasswordCsv({ email, passphrase })}
              >
                1Password CSV
              </button>
              <button
                type="button"
                className={styles.ghost}
                onClick={() => downloadEmergencyKit({ email, passphrase })}
              >
                Download kit
              </button>
              <button
                type="button"
                className={styles.ghost}
                onClick={() => printEmergencyKit({ email, passphrase })}
              >
                Print / PDF
              </button>
            </div>
          </div>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={saved}
              onChange={event => setSaved(event.target.checked)}
            />
            I wrote this passphrase down
          </label>
          <button type="button" className={styles.link} onClick={() => setMode('custom')}>
            Use my own instead
          </button>
        </>
      ) : (
        <>
          <p className={styles.hint}>
            Prefer six or more random words. Short passwords are easy to attack offline.
          </p>
          <input
            type="password"
            className={styles.input}
            autoComplete="new-password"
            placeholder="Passphrase"
            value={passphrase}
            onChange={event => onPassphraseChange(event.target.value)}
            autoFocus
          />
          <input
            type="password"
            className={styles.input}
            autoComplete="new-password"
            placeholder="Confirm passphrase"
            value={passphraseConfirm}
            onChange={event => onConfirmChange(event.target.value)}
          />
          <div className={styles.meter} data-score={strength.score} aria-live="polite">
            <span />
            <span />
            <span />
            <span />
          </div>
          <p className={styles.meterLabel}>{strength.label}</p>
          <SaveToOnePasswordButton email={email} passphrase={passphrase} />
          <button type="button" className={styles.link} onClick={useGenerated}>
            Generate six words instead
          </button>
        </>
      )}
      {passphrase && passphraseConfirm && passphrase !== passphraseConfirm ? (
        <p className={styles.error}>Passphrases do not match.</p>
      ) : null}
      {error ? <p className={styles.error}>{error}</p> : null}
      <button type="submit" className={styles.submit} disabled={!canSubmit}>
        {submitLabel}
      </button>
    </form>
  );
}

export function seedGeneratedPassphrase(): string {
  return generatePassphrase();
}

export { MIN_CUSTOM_SCORE };
