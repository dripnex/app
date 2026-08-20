import { useCallback, useEffect, useState } from 'react';
import { Bot, Check, Copy, Eye, EyeOff } from 'lucide';
import { Icon } from '../../../ui/icons/Icon';
import { Button, Field, Toggle } from '../../../ui/primitives';
import { SettingsCard } from '../components/SettingsCard';
import { useSettingsStore, selectIntegrations } from '../../../stores/settings';
import {
  buildClaudeSnippet,
  buildCodexSnippet,
  launchFromConnection,
} from '../../../utils/mcpSnippets';
import type { LocalServerConnectionInfo } from '../../../../preload/api/localServer';
import styles from './IntegrationsSection.module.css';

const START_POLL_MS = 750;
const MAX_START_POLLS = 20;

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

export function McpCard() {
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
      setError(err instanceof Error ? err.message : 'Could not load MCP connection.');
    }
  }, [api]);

  useEffect(() => {
    if (!ready) return;
    void refresh();
  }, [ready, refresh, integrations.mcpEnabled]);

  useEffect(() => {
    if (!ready || !integrations.mcpEnabled || info?.running) return;
    let attempts = 0;
    const id = window.setInterval(() => {
      attempts += 1;
      if (attempts > MAX_START_POLLS) {
        window.clearInterval(id);
        setError('The local MCP server did not start.');
        return;
      }
      void refresh();
    }, START_POLL_MS);
    return () => window.clearInterval(id);
  }, [ready, refresh, integrations.mcpEnabled, info?.running]);

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(null), 1600);
    return () => window.clearTimeout(id);
  }, [copied]);

  const launch = info
    ? launchFromConnection({
        dbPath: info.dbPath,
        mcpCommand: info.mcpCommand,
        mcpArgs: info.mcpArgs,
      })
    : null;
  const claude = launch ? buildClaudeSnippet(launch) : '';
  const codex = launch ? buildCodexSnippet(launch) : '';

  const copy = async (key: string, value: string) => {
    if (await copyText(value)) setCopied(key);
  };

  const enabled = integrations.mcpEnabled;
  const badge = !ready ? 'Restart Dripnex' : enabled ? (info?.running ? 'On' : 'Starting') : 'Off';
  const badgeTone = !ready ? 'warn' : enabled && info?.running ? 'ok' : 'idle';

  return (
    <SettingsCard tone={badgeTone}>
      <div className={styles.cardTop}>
        <span className={styles.brandMark} aria-hidden="true">
          <Icon icon={Bot} size={18} />
        </span>
        <div className={styles.cardCopy}>
          <div className={styles.cardNameRow}>
            <h3 className={styles.cardName}>MCP</h3>
            <span className={styles.badge} data-tone={badgeTone}>
              {badge}
            </span>
          </div>
          <p className={styles.cardDesc}>
            Let Claude Code and Codex search your notes. This starts the local HTTP API on this
            machine.
          </p>
        </div>
        <Toggle
          id="mcp-enabled"
          checked={enabled}
          disabled={!ready}
          onChange={checked => updateIntegrations({ mcpEnabled: checked })}
        />
      </div>

      {!ready ? (
        <p className={styles.callout} data-tone="warn">
          This window opened before the MCP bridge loaded. Quit Dripnex completely and open it again
          — Settings does not pick up preload changes on refresh.
        </p>
      ) : null}

      {ready && enabled && info ? (
        <div className={styles.body}>
          <Field label="Local URL" htmlFor="mcp-url" hint="Scripts and the later clipper use this.">
            <div className={styles.copyRow}>
              <code id="mcp-url" className={styles.monoValue}>
                {info.url}
              </code>
              <CopyButton
                label="Copy URL"
                copied={copied === 'url'}
                onClick={() => void copy('url', info.url)}
              />
            </div>
          </Field>

          <Field
            label="Token"
            htmlFor="mcp-token"
            hint="Bearer token for the local HTTP API. Stays on this machine."
          >
            <div className={styles.copyRow}>
              <code id="mcp-token" className={styles.monoValue}>
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
              <CopyButton
                label="Copy token"
                copied={copied === 'token'}
                onClick={() => void copy('token', info.token)}
              />
            </div>
          </Field>

          <SnippetBlock
            id="mcp-claude"
            label="Claude Code"
            value={claude}
            copied={copied === 'claude'}
            onCopy={() => void copy('claude', claude)}
          />
          <SnippetBlock
            id="mcp-codex"
            label="Codex"
            value={codex}
            copied={copied === 'codex'}
            onCopy={() => void copy('codex', codex)}
          />

          <div className={styles.writesRow}>
            <div>
              <label className={styles.fieldLabel} htmlFor="mcp-writes">
                Allow writes
              </label>
              <p className={styles.fieldHint}>
                Create, update, and trash from agents. Off until you flip this — no need to recopy
                the snippet.
              </p>
            </div>
            <Toggle
              id="mcp-writes"
              checked={integrations.mcpWrites}
              onChange={checked => updateIntegrations({ mcpWrites: checked })}
            />
          </div>
        </div>
      ) : null}

      {error ? <p className={styles.error}>{error}</p> : null}
    </SettingsCard>
  );
}

function CopyButton({
  label,
  copied,
  onClick,
}: {
  label: string;
  copied: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      icon={copied ? <Icon icon={Check} size={14} /> : <Icon icon={Copy} size={14} />}
      onClick={onClick}
    >
      {copied ? 'Copied' : label}
    </Button>
  );
}

function SnippetBlock({
  id,
  label,
  value,
  copied,
  onCopy,
}: {
  id: string;
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className={styles.snippet}>
      <div className={styles.snippetBar}>
        <span className={styles.fieldLabel}>{label}</span>
        <CopyButton label="Copy" copied={copied} onClick={onCopy} />
      </div>
      <pre id={id} className={styles.snippetPre}>
        {value}
      </pre>
    </div>
  );
}
