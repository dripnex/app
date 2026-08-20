import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, Eye, EyeOff, Server } from 'lucide';
import { Icon } from '../../../ui/icons/Icon';
import { Button, Field } from '../../../ui/primitives';
import { SettingsCard } from '../components/SettingsCard';
import { SettingToggle } from '../components/SettingToggle';
import { useSettingsStore, selectIntegrations } from '../../../stores/settings';
import type { LocalServerConnectionInfo } from '../../../../preload/api/localServer';
import styles from './IntegrationsSection.module.css';

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

const ENDPOINTS = [
  'GET /api/status',
  'GET /api/notes',
  'GET /api/notes/:id',
  'POST /api/notes',
  'PUT /api/notes/:id',
  'GET /api/notes/search?q=',
  'DELETE /api/notes/:id',
  'GET /api/books',
  'POST /api/books',
  'PUT /api/books/:id',
  'DELETE /api/books/:id',
  'GET /api/tags',
  'POST /api/tags',
  'PUT /api/tags/:name',
  'GET /api/_changes?since=',
];

export function LocalHttpCard() {
  const integrations = useSettingsStore(selectIntegrations);
  const updateIntegrations = useSettingsStore(s => s.updateIntegrations);
  const api = window.dripnex?.localServer;
  const ready = typeof api?.connectionInfo === 'function';

  const [info, setInfo] = useState<LocalServerConnectionInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!api?.connectionInfo) return;
    try {
      setInfo(await api.connectionInfo());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load local HTTP status.');
    }
  }, [api]);

  const enabled = integrations.httpApiEnabled || integrations.mcpEnabled;

  useEffect(() => {
    if (!ready) return;
    void refresh();
  }, [ready, refresh, enabled]);

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(null), 1600);
    return () => window.clearTimeout(id);
  }, [copied]);

  const copy = async (key: string, value: string) => {
    if (await copyText(value)) setCopied(key);
  };

  const badge = !ready ? 'Restart Dripnex' : enabled ? (info?.running ? 'On' : 'Starting') : 'Off';
  const badgeTone = !ready ? 'warn' : enabled && info?.running ? 'ok' : 'idle';

  return (
    <SettingsCard tone={badgeTone}>
      <div className={styles.cardTop}>
        <span className={styles.brandMark} aria-hidden="true">
          <Icon icon={Server} size={18} />
        </span>
        <div className={styles.cardCopy}>
          <div className={styles.cardNameRow}>
            <h3 className={styles.cardName}>Local HTTP</h3>
            <span className={styles.badge} data-tone={badgeTone}>
              {badge}
            </span>
          </div>
          <p className={styles.cardDesc}>
            Loopback API for scripts, Raycast, and the clipper. Bearer token, this machine only.
          </p>
        </div>
      </div>
      <SettingToggle
        flush
        label="Enable Local HTTP"
        description="Expose the loopback API on this machine."
        htmlFor="http-api-enabled"
        checked={integrations.httpApiEnabled}
        disabled={!ready}
        onChange={checked => updateIntegrations({ httpApiEnabled: checked })}
      />

      {error ? (
        <p className={styles.callout} data-tone="warn">
          {error}
        </p>
      ) : null}

      {ready && enabled && info ? (
        <div className={styles.body}>
          <Field label="URL" htmlFor="http-url">
            <div className={styles.copyRow}>
              <code id="http-url" className={styles.monoValue}>
                {info.url}
              </code>
              <Button
                variant="ghost"
                size="sm"
                icon={
                  copied === 'url' ? (
                    <Icon icon={Check} size={14} />
                  ) : (
                    <Icon icon={Copy} size={14} />
                  )
                }
                onClick={() => void copy('url', info.url)}
              >
                {copied === 'url' ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </Field>

          <Field label="Token" htmlFor="http-token" hint="Authorization: Bearer …">
            <div className={styles.copyRow}>
              <code id="http-token" className={styles.monoValue}>
                {showToken ? info.token : '•'.repeat(12) + info.token.slice(-4)}
              </code>
              <Button
                variant="ghost"
                size="sm"
                icon={showToken ? <Icon icon={EyeOff} size={14} /> : <Icon icon={Eye} size={14} />}
                onClick={() => setShowToken(v => !v)}
              >
                {showToken ? 'Hide' : 'Show'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                icon={
                  copied === 'token' ? (
                    <Icon icon={Check} size={14} />
                  ) : (
                    <Icon icon={Copy} size={14} />
                  )
                }
                onClick={() => void copy('token', info.token)}
              >
                {copied === 'token' ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </Field>

          <p className={styles.fieldHint}>{ENDPOINTS.join(' · ')}</p>
        </div>
      ) : null}
    </SettingsCard>
  );
}
