import { useState } from 'react';
import { CheckCircle, ExternalLink, KeyRound, Loader2 } from 'lucide';
import { Icon } from '../../../ui/icons/Icon';
import { Button, Field, Input } from '../../../ui/primitives';
import type { ProviderCatalogItem } from './providers';
import { SaveProviderKey } from './SaveProviderKey';
import styles from './ProviderConnect.module.css';

function maskKey(key: string): string {
  if (key.length < 12) return '••••••••';
  return `${key.slice(0, 8)}…${key.slice(-4)}`;
}

function looksComplete(item: ProviderCatalogItem, value: string): boolean {
  const key = value.trim();
  if (key.length < 20) return false;
  if (item.id === 'anthropic') return key.startsWith('sk-ant-');
  if (item.id === 'openai') return key.startsWith('sk-');
  if (item.id === 'grok') return key.startsWith('xai-');
  return false;
}

interface ProviderConnectProps {
  item: ProviderCatalogItem;
  connected: boolean;
  connecting: boolean;
  storedKey: string;
  error: string | null;
  value: string;
  onChange: (value: string) => void;
  onConnect: () => void;
  onDisconnect: () => void;
}

export function ProviderConnect({
  item,
  connected,
  connecting,
  storedKey,
  error,
  value,
  onChange,
  onConnect,
  onDisconnect,
}: ProviderConnectProps) {
  const [replacing, setReplacing] = useState(false);
  const showForm = !connected || replacing;

  if (item.kind === 'included') {
    return null;
  }

  if (item.kind === 'local') {
    return null;
  }

  if (!showForm) {
    return (
      <div className={styles.savedBlock}>
        <div className={styles.saved}>
          <div className={styles.savedCopy}>
            <Icon icon={CheckCircle} size={14} className={styles.savedIcon} />
            <div>
              <div className={styles.savedTitle}>Saved in the keychain</div>
              <div className={styles.savedKey}>{maskKey(storedKey || value)}</div>
            </div>
          </div>
          <div className={styles.savedActions}>
            <button type="button" className={styles.textBtn} onClick={() => setReplacing(true)}>
              Replace
            </button>
            <button type="button" className={styles.textBtn} onClick={onDisconnect}>
              Remove
            </button>
          </div>
        </div>
        <SaveProviderKey item={item} apiKey={storedKey || value} />
      </div>
    );
  }

  return (
    <div className={styles.form}>
      <a className={styles.authorize} href={item.keyUrl} target="_blank" rel="noreferrer">
        Continue with {item.name}
        <Icon icon={ExternalLink} size={12} />
      </a>
      <p className={styles.or}>
        Then paste the key once. Providers do not offer a public OAuth for apps yet.
      </p>
      <Field
        label={
          <>
            <Icon icon={KeyRound} size={12} />
            API key
          </>
        }
        htmlFor={`key-${item.id}`}
        error={error}
      >
        <Input
          id={`key-${item.id}`}
          type="password"
          mono
          value={value}
          onChange={event => onChange(event.target.value)}
          placeholder={item.placeholder}
          autoComplete="off"
          spellCheck={false}
          autoFocus={replacing}
          invalid={Boolean(error)}
          onPaste={event => {
            const pasted = event.clipboardData.getData('text');
            if (looksComplete(item, pasted)) {
              window.setTimeout(() => onConnect(), 0);
            }
          }}
          onKeyDown={event => {
            if (event.key === 'Enter') onConnect();
          }}
        />
      </Field>
      <div className={styles.footer}>
        <div className={styles.footerActions}>
          {replacing ? (
            <button type="button" className={styles.textBtn} onClick={() => setReplacing(false)}>
              Cancel
            </button>
          ) : null}
          <Button
            variant="primary"
            size="sm"
            loading={connecting}
            disabled={connecting || !value.trim()}
            onClick={onConnect}
          >
            {connecting ? 'Verifying…' : 'Verify and save'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function OllamaConnect({
  url,
  connecting,
  connected,
  error,
  onUrlChange,
  onConnect,
}: {
  url: string;
  connecting: boolean;
  connected: boolean;
  error: string | null;
  onUrlChange: (value: string) => void;
  onConnect: () => void;
}) {
  return (
    <div className={styles.form}>
      {connected ? (
        <div className={styles.saved}>
          <div className={styles.savedCopy}>
            <Icon icon={CheckCircle} size={14} className={styles.savedIcon} />
            <div>
              <div className={styles.savedTitle}>Ollama is reachable</div>
              <div className={styles.savedKey}>{url || 'http://127.0.0.1:11434'}</div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <Field label="Host" htmlFor="ollama-url" error={error}>
            <Input
              id="ollama-url"
              type="url"
              mono
              value={url}
              onChange={event => onUrlChange(event.target.value)}
              placeholder="http://127.0.0.1:11434"
              spellCheck={false}
              invalid={Boolean(error)}
              onKeyDown={event => {
                if (event.key === 'Enter') onConnect();
              }}
            />
          </Field>
          <div className={styles.footer}>
            <a
              className={styles.link}
              href="https://ollama.com/download"
              target="_blank"
              rel="noreferrer"
            >
              Install Ollama
              <Icon icon={ExternalLink} size={11} />
            </a>
            <Button variant="primary" size="sm" loading={connecting} onClick={onConnect}>
              {connecting ? (
                <>
                  <Icon icon={Loader2} size={12} />
                  Checking…
                </>
              ) : (
                'Check connection'
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
