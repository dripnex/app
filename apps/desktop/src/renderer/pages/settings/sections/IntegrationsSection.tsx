import { useEffect, useState } from 'react';
import { ExternalLink, KeyRound } from 'lucide-react';
import { OnePasswordMark } from '../../../integrations/OnePasswordMark';
import { discoverOnePassword, setOnePasswordAccount } from '../../../integrations/onepassword';
import { Button } from '../../../ui/primitives';
import { GitHubCard } from './GitHubCard';
import styles from './IntegrationsSection.module.css';

interface IntegrationsSectionProps {
  onOpenEncryption?: () => void;
}

export function IntegrationsSection({ onOpenEncryption }: IntegrationsSectionProps) {
  const [status, setStatus] = useState<'checking' | 'ready' | 'stale'>('checking');
  const [stored, setStored] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [accountMessage, setAccountMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void discoverOnePassword().then(result => {
      if (cancelled) return;
      setStatus(result.available ? 'ready' : 'stale');
      setStored(result.stored);
      setAccounts(result.accounts);
      setDraft(result.stored ?? (result.accounts.length === 1 ? result.accounts[0]! : ''));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const linked = Boolean(stored);
  const badge =
    status === 'checking'
      ? 'Checking'
      : status === 'stale'
        ? 'Restart Dripnex'
        : linked
          ? 'Connected'
          : 'Ready';
  const badgeTone =
    status === 'stale'
      ? 'warn'
      : status === 'ready' && linked
        ? 'ok'
        : status === 'ready'
          ? 'idle'
          : 'idle';

  const saveAccount = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const result = await setOnePasswordAccount(trimmed);
    if (!result.success) {
      setAccountMessage(result.error ?? 'Could not remember this account.');
      return;
    }
    setStored(trimmed);
    setDraft(trimmed);
    setAccountMessage('Account remembered. Next save goes here.');
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h2 className={styles.title}>Integrations</h2>
        <p className={styles.lede}>Connect tools you already use. Secrets stay on this machine.</p>
      </header>

      <GitHubCard />

      <article className={styles.card} data-tone={badgeTone}>
        <div className={styles.cardTop}>
          <OnePasswordMark size={36} />
          <div className={styles.cardCopy}>
            <div className={styles.cardNameRow}>
              <h3 className={styles.cardName}>1Password</h3>
              <span className={styles.badge} data-tone={badgeTone}>
                {badge}
              </span>
            </div>
            <p className={styles.cardDesc}>
              Creates a login in your Personal vault. You approve it in 1Password with Touch ID.
            </p>
          </div>
        </div>

        {status === 'stale' ? (
          <p className={styles.callout} data-tone="warn">
            This window opened before the 1Password bridge loaded. Quit Dripnex completely and open
            it again — Settings does not pick up preload changes on refresh.
          </p>
        ) : null}

        {status === 'ready' ? (
          <div className={styles.body}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Account</span>
              <span className={styles.fieldHint}>
                The name at the top of the 1Password sidebar. Remembered after the first save.
              </span>
              <input
                className={styles.input}
                value={draft}
                onChange={event => {
                  setDraft(event.target.value);
                  setAccountMessage(null);
                }}
                placeholder="e.g. my.1password.com"
                autoComplete="off"
              />
            </label>
            {accounts.length > 1 ? (
              <div className={styles.chips}>
                {accounts.map(name => (
                  <button
                    key={name}
                    type="button"
                    className={styles.chip}
                    data-active={name === stored || name === draft}
                    onClick={() => void saveAccount(name)}
                  >
                    {name}
                  </button>
                ))}
              </div>
            ) : null}
            <div className={styles.actions}>
              <Button
                variant="secondary"
                size="sm"
                disabled={!draft.trim() || draft.trim() === stored}
                onClick={() => void saveAccount(draft)}
              >
                Remember account
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={<KeyRound size={14} />}
                onClick={() => onOpenEncryption?.()}
              >
                Save passphrase
              </Button>
            </div>
            {accountMessage ? <p className={styles.hintOk}>{accountMessage}</p> : null}
          </div>
        ) : null}

        <ol className={styles.steps}>
          <li>
            In 1Password: <strong>Settings → Developer → Integrate with 1Password SDKs</strong>
          </li>
          <li>Keep 1Password unlocked (Touch ID is fine).</li>
          <li>
            From Encryption, choose <strong>Save to 1Password</strong> and approve the prompt.
          </li>
        </ol>

        <a
          className={styles.docLink}
          href="https://developer.1password.com/docs/sdks/"
          target="_blank"
          rel="noreferrer"
        >
          1Password SDK docs
          <ExternalLink size={12} />
        </a>
      </article>
    </div>
  );
}
