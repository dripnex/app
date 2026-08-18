import { useCallback, useEffect, useState } from 'react';
import { OnePasswordMark } from '../../../integrations/OnePasswordMark';
import { discoverOnePassword, saveSecretToOnePassword } from '../../../integrations/onepassword';
import type { ProviderCatalogItem } from './providers';
import styles from '../../../components/sync/SaveToOnePasswordButton.module.css';

interface SaveProviderKeyProps {
  item: ProviderCatalogItem;
  apiKey: string;
}

export function providerKeyItemTitle(name: string): string {
  return `Dripnex · ${name}`;
}

export function SaveProviderKey({ item, apiKey }: SaveProviderKeyProps) {
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
      const key = apiKey.trim();
      if (!key || busy) return;
      setBusy(true);
      setError(null);
      setStatus(null);
      try {
        const result = await saveSecretToOnePassword({
          account: accountName?.trim() || null,
          title: providerKeyItemTitle(item.name),
          username: item.id,
          password: key,
          notes: `${item.name} API key for Dripnex. Also stored in the system keychain.`,
          websiteUrl: item.keyUrl,
          websiteLabel: item.name,
        });
        if (result.success) {
          setNeedsAccount(false);
          setStatus(`Saved in ${result.vaultTitle}`);
          return;
        }
        if ('needsAccount' in result && result.needsAccount) {
          setNeedsAccount(true);
          setAccounts(result.accounts);
          setError('Enter the account name at the top of the 1Password sidebar.');
          return;
        }
        setError(result.error);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Could not reach 1Password.');
      } finally {
        setBusy(false);
      }
    },
    [apiKey, busy, item]
  );

  if (!available && !status) return null;

  const caption = busy ? 'Waiting for 1Password…' : (status ?? 'Save to 1Password');

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={styles.link}
        disabled={busy || !apiKey.trim()}
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
