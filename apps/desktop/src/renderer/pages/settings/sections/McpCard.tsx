import { useCallback, useEffect, useRef, useState } from 'react';
import { Bot, Check, Copy, Eye, EyeOff } from 'lucide';
import { Icon } from '../../../ui/icons/Icon';
import { Button, Field, toast } from '../../../ui/primitives';
import { SettingsCard } from '../components/SettingsCard';
import { SettingToggle } from '../components/SettingToggle';
import { useSettingsStore, selectIntegrations } from '../../../stores/settings';
import {
  buildClaudeSnippet,
  buildCodexSnippet,
  launchFromConnection,
} from '../../../utils/mcpSnippets';
import type { LocalServerConnectionInfo } from '../../../../preload/api/localServer';
import {
  COPY_FAILED,
  LOCAL_SERVER_BRIDGE_STALE,
  LOCAL_SERVER_MAX_START_POLLS,
  LOCAL_SERVER_START_POLL_MS,
  MCP_DID_NOT_START,
  MCP_LOAD_ERROR,
  MCP_STARTING,
  isCurrentStartGeneration,
  localServerBodyState,
  shouldApplyStartPollResult,
} from './localServerCopy';
import styles from './IntegrationsSection.module.css';

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
  const startGenRef = useRef(0);

  const refresh = useCallback(
    async (opts?: { ignore?: () => boolean }) => {
      if (!api?.connectionInfo) return;
      try {
        const next = await api.connectionInfo();
        if (opts?.ignore && !shouldApplyStartPollResult(opts.ignore())) return;
        setInfo(next);
        setError(null);
      } catch (err) {
        if (opts?.ignore && !shouldApplyStartPollResult(opts.ignore())) return;
        setError(err instanceof Error ? err.message : MCP_LOAD_ERROR);
      }
    },
    [api]
  );

  useEffect(() => {
    if (!ready) return;
    const gen = ++startGenRef.current;
    void refresh({ ignore: () => !isCurrentStartGeneration(gen, startGenRef.current) });
    return () => {
      if (startGenRef.current === gen) startGenRef.current += 1;
    };
  }, [ready, refresh, integrations.mcpEnabled]);

  useEffect(() => {
    if (!ready || !integrations.mcpEnabled || info?.running) return;
    const gen = ++startGenRef.current;
    let attempts = 0;
    const id = window.setInterval(() => {
      attempts += 1;
      if (attempts > LOCAL_SERVER_MAX_START_POLLS) {
        window.clearInterval(id);
        if (startGenRef.current === gen) {
          startGenRef.current += 1;
          setError(MCP_DID_NOT_START);
        }
        return;
      }
      void refresh({ ignore: () => !isCurrentStartGeneration(gen, startGenRef.current) });
    }, LOCAL_SERVER_START_POLL_MS);
    return () => {
      window.clearInterval(id);
      if (startGenRef.current === gen) startGenRef.current += 1;
    };
  }, [ready, refresh, integrations.mcpEnabled, info?.running]);

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(null), 1600);
    return () => window.clearTimeout(id);
  }, [copied]);

  const httpOn = integrations.httpApiEnabled || integrations.mcpEnabled || Boolean(info?.running);
  const launch = info
    ? launchFromConnection({
        dbPath: info.dbPath,
        mcpCommand: info.mcpCommand,
        mcpArgs: info.mcpArgs,
        url: info.url,
        token: info.token,
        httpEnabled: httpOn,
      })
    : null;
  const claude = launch ? buildClaudeSnippet(launch) : '';
  const codex = launch ? buildCodexSnippet(launch) : '';

  const copy = async (key: string, value: string) => {
    if (await copyText(value)) {
      setCopied(key);
      return;
    }
    toast.error(COPY_FAILED);
  };

  const enabled = integrations.mcpEnabled;
  const bodyState = localServerBodyState({
    ready,
    enabled,
    running: Boolean(info?.running),
    error,
  });
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
      </div>
      <SettingToggle
        flush
        label="Enable MCP"
        description="Start the local MCP server for Claude Code and Codex."
        htmlFor="mcp-enabled"
        checked={enabled}
        disabled={!ready}
        onChange={checked => updateIntegrations({ mcpEnabled: checked })}
      />

      {bodyState === 'stale' ? (
        <p className={styles.callout} data-tone="warn">
          {LOCAL_SERVER_BRIDGE_STALE}
        </p>
      ) : null}

      {bodyState === 'starting' ? <p className={styles.statusHint}>{MCP_STARTING}</p> : null}

      {bodyState === 'running' && info ? (
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

          <SettingToggle
            flush
            label="Allow writes"
            description="Create, update, and trash from agents. Off until you flip this — no need to recopy the snippet."
            htmlFor="mcp-writes"
            checked={integrations.mcpWrites}
            onChange={checked => updateIntegrations({ mcpWrites: checked })}
          />
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
