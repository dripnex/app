import { useCallback, useEffect, useState } from 'react';
import { Plug, Plus, Trash2 } from 'lucide';
import { Icon } from '../../../ui/icons/Icon';
import { Button, Field, Input, toast } from '../../../ui/primitives';
import { SettingsCard } from '../components/SettingsCard';
import type {
  McpConnectionState,
  McpServerConfig,
  McpServerEntry,
} from '../../../../preload/api/mcpClient';
import styles from './IntegrationsSection.module.css';

function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function statusBadge(state: McpConnectionState): { label: string; tone: 'ok' | 'warn' | 'idle' } {
  switch (state.status) {
    case 'connected':
      return { label: `Connected (${state.toolCount} tools)`, tone: 'ok' };
    case 'connecting':
      return { label: 'Connecting…', tone: 'idle' };
    case 'error':
      return { label: state.error ?? 'Error', tone: 'warn' };
    default:
      return { label: 'Off', tone: 'idle' };
  }
}

export function McpClientsCard() {
  const api = window.dripnex?.mcpClient;
  const ready = typeof api?.list === 'function';

  const [entries, setEntries] = useState<McpServerEntry[]>([]);
  const [name, setName] = useState('');
  const [command, setCommand] = useState('');
  const [args, setArgs] = useState('');

  const refresh = useCallback(async () => {
    if (!api) return;
    try {
      setEntries(await api.list());
    } catch {
      toast.error('Could not load configured MCP servers');
    }
  }, [api]);

  useEffect(() => {
    if (ready) void refresh();
  }, [ready, refresh]);

  const addServer = async () => {
    if (!api) return;
    const trimmedName = name.trim();
    const trimmedCommand = command.trim();
    if (!trimmedName || !trimmedCommand) return;
    const config: McpServerConfig = {
      id: randomId(),
      name: trimmedName,
      command: trimmedCommand,
      args: args.trim() ? args.trim().split(/\s+/) : [],
      enabled: true,
    };
    try {
      await api.save(config);
      setName('');
      setCommand('');
      setArgs('');
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not add server');
    }
  };

  const removeServer = async (id: string) => {
    if (!api) return;
    try {
      await api.remove(id);
      await refresh();
    } catch {
      toast.error('Could not remove server');
    }
  };

  const toggleConnection = async (entry: McpServerEntry) => {
    if (!api) return;
    try {
      if (entry.state.status === 'connected' || entry.state.status === 'connecting') {
        await api.disconnect(entry.config.id);
      } else {
        await api.connect(entry.config.id);
      }
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update connection');
    }
  };

  return (
    <SettingsCard tone="idle">
      <div className={styles.cardTop}>
        <span className={styles.brandMark} aria-hidden="true">
          <Icon icon={Plug} size={18} />
        </span>
        <div className={styles.cardCopy}>
          <div className={styles.cardNameRow}>
            <h3 className={styles.cardName}>Connect MCP servers</h3>
          </div>
          <p className={styles.cardDesc}>
            The opposite of the MCP card above: let Dripnex's own chat call tools from MCP servers
            you run locally (Linear, Slack, your own scripts). Every call still needs your
            confirmation.
          </p>
        </div>
      </div>

      {!ready ? (
        <p className={styles.callout} data-tone="warn">
          Restart Dripnex to use MCP server connections.
        </p>
      ) : (
        <div className={styles.body}>
          {entries.map(entry => {
            const badge = statusBadge(entry.state);
            return (
              <div key={entry.config.id} className={styles.cardTop}>
                <div className={styles.cardCopy}>
                  <div className={styles.cardNameRow}>
                    <h3 className={styles.cardName}>{entry.config.name}</h3>
                    <span className={styles.badge} data-tone={badge.tone}>
                      {badge.label}
                    </span>
                  </div>
                  <p className={styles.cardDesc}>
                    {entry.config.command} {entry.config.args.join(' ')}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => void toggleConnection(entry)}>
                  {entry.state.status === 'connected' || entry.state.status === 'connecting'
                    ? 'Disconnect'
                    : 'Connect'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Icon icon={Trash2} size={14} />}
                  onClick={() => void removeServer(entry.config.id)}
                  aria-label={`Remove ${entry.config.name}`}
                />
              </div>
            );
          })}

          <Field label="Name" htmlFor="mcp-client-name">
            <Input
              id="mcp-client-name"
              value={name}
              onChange={event => setName(event.target.value)}
              placeholder="Linear"
              autoComplete="off"
            />
          </Field>
          <Field
            label="Command"
            htmlFor="mcp-client-command"
            hint="The stdio MCP server to run, e.g. npx @linear/mcp-server"
          >
            <Input
              id="mcp-client-command"
              value={command}
              onChange={event => setCommand(event.target.value)}
              placeholder="npx"
              autoComplete="off"
            />
          </Field>
          <Field label="Args" htmlFor="mcp-client-args" hint="Space-separated">
            <Input
              id="mcp-client-args"
              value={args}
              onChange={event => setArgs(event.target.value)}
              placeholder="-y @linear/mcp-server"
              autoComplete="off"
            />
          </Field>

          <div className={styles.actions}>
            <Button
              variant="secondary"
              size="sm"
              icon={<Icon icon={Plus} size={14} />}
              disabled={!name.trim() || !command.trim()}
              onClick={() => void addServer()}
            >
              Add server
            </Button>
          </div>
        </div>
      )}
    </SettingsCard>
  );
}
