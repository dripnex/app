import { useCallback, useEffect, useState } from 'react';
import { OnePasswordMark } from '../../integrations/OnePasswordMark';
import { discoverOnePassword, saveToOnePassword } from '../../integrations/onepassword';
import {
  ONE_PASSWORD_NEED_ACCOUNT,
  ONE_PASSWORD_UNREACHABLE,
  ONE_PASSWORD_WAITING,
  onePasswordSavedStatus,
  onePasswordSavedToast,
} from '../../integrations/onePasswordCopy';
import { toast } from '../../ui/primitives';
import styles from './SaveToOnePasswordButton.module.css';

interface SaveToOnePasswordButtonProps {
  email?: string | null;
  passphrase: string;
  recoveryKey?: string | null;
  variant?: 'ghost' | 'link';
  label?: string;
}

export function SaveToOnePasswordButton({
  email,
  passphrase,
  recoveryKey,
  variant = 'ghost',
  label = 'Save to 1Password',
}: SaveToOnePasswordButtonProps) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsAccount, setNeedsAccount] = useState(false);
  const [accounts, setAccounts] = useState<string[]>([]);
  const [account, setAccount] = useState('');
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void discoverOnePassword().then(result => {
      if (cancelled) return;
      setAvailable(result.available);
      if (result.stored) setAccount(result.stored);
      if (result.accounts.length > 0) setAccounts(result.accounts);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const save = useCallback(
    async (accountName?: string) => {
      if (!passphrase.trim() || busy) return;
      setBusy(true);
      setError(null);
      setStatus(null);
      try {
        const result = await saveToOnePassword({
          account: accountName?.trim() || null,
          email,
          passphrase,
          recoveryKey,
        });
        if (result.success) {
          setNeedsAccount(false);
          setStatus(onePasswordSavedStatus(result.vaultTitle));
          toast.success(onePasswordSavedToast(result.vaultTitle));
          return;
        }
        if ('needsAccount' in result && result.needsAccount) {
          setNeedsAccount(true);
          setAccounts(result.accounts);
          setError(ONE_PASSWORD_NEED_ACCOUNT);
          return;
        }
        setError(result.error);
        toast.error(result.error);
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : ONE_PASSWORD_UNREACHABLE;
        setError(message);
        toast.error(message);
      } finally {
        setBusy(false);
      }
    },
    [busy, email, passphrase, recoveryKey]
  );

  const caption = busy
    ? ONE_PASSWORD_WAITING
    : (status ?? (available ? label : 'Restart to enable 1Password'));

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={variant === 'link' ? styles.link : styles.ghost}
        disabled={busy || !passphrase.trim()}
        onClick={() => void save(account)}
      >
        <OnePasswordMark size={14} />
        {caption}
      </button>
      {needsAccount || (available && accounts.length > 1 && !account) ? (
        <div className={styles.account}>
          <input
            type="text"
            className={styles.input}
            value={account}
            onChange={event => setAccount(event.target.value)}
            placeholder="1Password account name"
            autoComplete="off"
          />
          {accounts.length > 0 ? (
            <div className={styles.chips}>
              {accounts.map(name => (
                <button
                  key={name}
                  type="button"
                  className={styles.chip}
                  onClick={() => {
                    setAccount(name);
                    void save(name);
                  }}
                >
                  {name}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
  );
}
