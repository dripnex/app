/**
 * AI Assistant Settings — one card per provider SDK.
 */

import { useState, useCallback, useEffect, useSyncExternalStore } from 'react';
import { CheckCircle, XCircle, Upload, Download, RefreshCw } from 'lucide-react';
import { aiCommandStore } from '@dripnex/plugin-api';
import type { AiCommandRegistration } from '@dripnex/plugin-api';
import { validateAiCommandPreset, serializePreset } from '@dripnex/ai-core';
import type { AiCommandPreset } from '@dripnex/ai-core';
import { useSettingsStore, selectAi, selectAiKeyHydrationError } from '../../../stores/settings';
import { SettingGroup } from '../components/SettingGroup';
import { SettingNumber } from '../components/SettingNumber';
import { SettingRow } from '../components/SettingRow';
import { SettingSelect } from '../components/SettingSelect';
import { Button } from '../../../ui/primitives';
import { FALLBACK_MODELS, PROVIDER_CATALOG, type AiProviderId } from '../ai/providers';
import { ProviderMark } from '../ai/ProviderMark';
import { OllamaConnect, ProviderConnect } from '../ai/ProviderConnect';
import { kbIndexDescription, kbStatusLabel } from '../../../components/ai/askNotesCopy';
import { SettingsCard } from '../components/SettingsCard';
import { SettingsPage } from '../components/SettingsPage';
import styles from './Section.module.css';
import cardStyles from './AiProviders.module.css';

type ConnectStatus = 'idle' | 'connecting' | 'connected' | 'error' | 'unavailable';

function useAiCommands(): AiCommandRegistration[] {
  return useSyncExternalStore(
    cb => aiCommandStore.subscribe(cb),
    () => aiCommandStore.getState().registrations
  );
}

function kindLabel(kind: 'included' | 'cloud' | 'local'): string {
  if (kind === 'included') return 'Account';
  if (kind === 'local') return 'Local';
  return 'Your key';
}

const PROVIDER_GROUPS: Array<{
  title: string;
  kinds: Array<'included' | 'cloud' | 'local'>;
}> = [
  { title: 'With your account', kinds: ['included'] },
  { title: 'Your own key', kinds: ['cloud'] },
  { title: 'This machine', kinds: ['local'] },
];

export function AiSection() {
  const ai = useSettingsStore(selectAi);
  const updateAi = useSettingsStore(s => s.updateAi);
  const hydrationError = useSettingsStore(selectAiKeyHydrationError);

  const [connectStatus, setConnectStatus] = useState<Record<string, ConnectStatus>>({});
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [connectError, setConnectError] = useState('');
  const [liveModels, setLiveModels] = useState<Array<{ value: string; label: string }>>([]);
  const [presetMessage, setPresetMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [kb, setKb] = useState<{
    pending: number;
    embedded: number;
    model: string;
    provider?: string;
    dim?: number;
  } | null>(null);
  const [embedCatalog, setEmbedCatalog] = useState<
    Array<{
      id: string;
      displayName: string;
      models: Array<{ id: string; displayName: string; dimensions: number }>;
    }>
  >([]);

  const registeredAiCommands = useAiCommands();
  const currentProvider = ai.provider;
  const catalog =
    PROVIDER_CATALOG.find(item => item.id === currentProvider) ?? PROVIDER_CATALOG[0]!;
  const isConnected = connectStatus[currentProvider] === 'connected';
  const isConnecting = connectStatus[currentProvider] === 'connecting';

  useEffect(() => {
    async function loadConnected() {
      if (!window.dripnex?.ai) return;
      const providers = await window.dripnex.ai.listConnectedProviders();
      const status: Record<string, ConnectStatus> = {};
      for (const provider of providers) {
        if (provider !== 'dripnex') status[provider] = 'connected';
      }
      try {
        const firstParty = await window.dripnex.ai.firstPartyStatus();
        status.dripnex = firstParty.available ? 'connected' : 'unavailable';
      } catch {
        status.dripnex = 'unavailable';
      }
      if (!status.ollama) {
        try {
          const result = await window.dripnex.ai.validate({
            provider: 'ollama',
            apiKey: '',
            baseUrl: useSettingsStore.getState().settings.ai.baseUrl || undefined,
          });
          if (result.ok) status.ollama = 'connected';
        } catch {
          // Ollama not running
        }
      }
      setConnectStatus(status);
      const current = useSettingsStore.getState().settings.ai.provider;
      const currentReady =
        current === 'dripnex' ? status.dripnex === 'connected' : status[current] === 'connected';
      if (status.dripnex === 'connected' && !currentReady) {
        const firstModel = FALLBACK_MODELS.dripnex[0]?.value;
        updateAi({
          provider: 'dripnex',
          ...(firstModel ? { model: firstModel } : {}),
        });
      }
    }
    void loadConnected();
  }, [updateAi]);

  const refreshKb = useCallback(async () => {
    const api = window.dripnex?.ai;
    if (!api || typeof api.kbStatus !== 'function') {
      setKb(null);
      return;
    }
    try {
      setKb(await api.kbStatus());
    } catch {
      setKb(null);
    }
  }, []);

  useEffect(() => {
    void refreshKb();
  }, [refreshKb]);

  useEffect(() => {
    const api = window.dripnex?.ai;
    if (!api || typeof api.kbCatalog !== 'function') return;
    void api
      .kbCatalog()
      .then(setEmbedCatalog)
      .catch(() => setEmbedCatalog([]));
  }, []);

  const embedProvider = ai.embedProvider ?? 'ollama';
  const embedModel = ai.embedModel ?? 'nomic-embed-text';
  const embedProviderEntry =
    embedCatalog.find(item => item.id === embedProvider) ?? embedCatalog[0];
  const embedModelOptions = (embedProviderEntry?.models ?? []).map(model => ({
    value: model.id,
    label: `${model.displayName} (${model.dimensions}d)`,
  }));

  const applyEmbed = useCallback(
    async (next: { embedProvider: 'ollama' | 'openai'; embedModel: string }) => {
      updateAi(next);
      const api = window.dripnex?.ai;
      if (api && typeof api.kbSetEmbed === 'function') {
        await api.kbSetEmbed({
          provider: next.embedProvider,
          model: next.embedModel,
          baseUrl: useSettingsStore.getState().settings.ai.baseUrl || undefined,
        });
      }
      await refreshKb();
    },
    [updateAi, refreshKb]
  );

  useEffect(() => {
    if (!isConnected) {
      setLiveModels([]);
      return;
    }
    let cancelled = false;
    if (!window.dripnex?.ai) {
      return () => {
        cancelled = true;
      };
    }
    void window.dripnex.ai
      .listModels({
        provider: currentProvider,
        apiKey: currentProvider === 'ollama' || currentProvider === 'dripnex' ? '' : ai.apiKey,
        baseUrl: ai.baseUrl || undefined,
      })
      .then(result => {
        if (cancelled) return;
        if (!result.ok || result.models.length === 0) {
          setLiveModels([]);
          return;
        }
        setLiveModels(
          result.models.map(model => ({
            value: model.id,
            label: model.displayName ?? model.id,
          }))
        );
      })
      .catch(() => {
        if (!cancelled) setLiveModels([]);
      });
    return () => {
      cancelled = true;
    };
  }, [currentProvider, isConnected, ai.apiKey, ai.baseUrl]);

  const modelOptions =
    liveModels.length > 0 ? liveModels : (FALLBACK_MODELS[currentProvider] ?? []);

  const selectProvider = useCallback(
    (next: AiProviderId) => {
      const firstModel = FALLBACK_MODELS[next]?.[0]?.value;
      updateAi({
        provider: next,
        ...(firstModel ? { model: firstModel } : {}),
      });
      setConnectError('');
      setApiKeyInput('');
    },
    [updateAi]
  );

  const handleConnect = useCallback(async () => {
    if (currentProvider === 'ollama') {
      setConnectStatus(prev => ({ ...prev, ollama: 'connecting' }));
      setConnectError('');
      try {
        const result = await window.dripnex.ai.validate({
          provider: 'ollama',
          apiKey: '',
          baseUrl: useSettingsStore.getState().settings.ai.baseUrl || undefined,
        });
        if (result.ok) {
          setConnectStatus(prev => ({ ...prev, ollama: 'connected' }));
        } else {
          setConnectStatus(prev => ({ ...prev, ollama: 'error' }));
          setConnectError(result.error || 'Cannot reach Ollama. Is it running?');
        }
      } catch (err) {
        setConnectStatus(prev => ({ ...prev, ollama: 'error' }));
        setConnectError(err instanceof Error ? err.message : 'Connection failed');
      }
      return;
    }

    if (!apiKeyInput.trim()) {
      setConnectError('Paste your API key');
      return;
    }

    setConnectStatus(prev => ({ ...prev, [currentProvider]: 'connecting' }));
    setConnectError('');

    try {
      const result = await window.dripnex.ai.validate({
        provider: currentProvider,
        apiKey: apiKeyInput.trim(),
      });

      if (result.ok) {
        await window.dripnex.ai.saveKey(currentProvider, apiKeyInput.trim());
        updateAi({ apiKey: apiKeyInput.trim() });
        setConnectStatus(prev => ({ ...prev, [currentProvider]: 'connected' }));
        setApiKeyInput('');
      } else {
        setConnectStatus(prev => ({ ...prev, [currentProvider]: 'error' }));
        setConnectError(result.error || 'Invalid API key');
      }
    } catch (err) {
      setConnectStatus(prev => ({ ...prev, [currentProvider]: 'error' }));
      setConnectError(err instanceof Error ? err.message : 'Connection failed');
    }
  }, [currentProvider, apiKeyInput, updateAi]);

  const handleDisconnect = useCallback(async () => {
    await window.dripnex.ai.removeKey(currentProvider);
    updateAi({ apiKey: '' });
    setConnectStatus(prev => ({ ...prev, [currentProvider]: 'idle' }));
    setConnectError('');
  }, [currentProvider, updateAi]);

  useEffect(() => {
    async function loadKeyForProvider() {
      if (currentProvider === 'ollama' || currentProvider === 'dripnex') return;
      try {
        const key = await window.dripnex.ai.getKey(currentProvider);
        if (key) updateAi({ apiKey: key });
        setConnectError('');
      } catch (err) {
        setConnectError(err instanceof Error ? err.message : 'Failed to load API key');
      }
    }
    void loadKeyForProvider();
  }, [currentProvider, updateAi]);

  const handleExportPreset = useCallback(async () => {
    setPresetMessage(null);
    if (registeredAiCommands.length === 0) {
      setPresetMessage({ type: 'error', text: 'No custom AI commands to export.' });
      return;
    }
    const preset: AiCommandPreset = {
      name: 'My AI Commands',
      version: '1.0.0',
      description: 'Exported AI command preset',
      commands: registeredAiCommands.map(cmd => ({
        id: cmd.id,
        name: cmd.name,
        description: cmd.description,
        systemPrompt: cmd.systemPrompt,
        userPromptTemplate: cmd.userPromptTemplate,
        icon: cmd.icon,
        outputTarget: cmd.outputTarget,
        category: cmd.category,
      })),
    };
    try {
      const result = await window.dripnex.ai.exportPreset(serializePreset(preset));
      if (result.ok) {
        setPresetMessage({
          type: 'success',
          text: `Exported ${preset.commands.length} command(s).`,
        });
      } else if (result.error !== 'Export cancelled') {
        setPresetMessage({ type: 'error', text: result.error });
      }
    } catch (err) {
      setPresetMessage({ type: 'error', text: err instanceof Error ? err.message : String(err) });
    }
  }, [registeredAiCommands]);

  const handleImportPreset = useCallback(async () => {
    setPresetMessage(null);
    try {
      const result = await window.dripnex.ai.importPreset();
      if (!result.ok) {
        if (result.error !== 'Import cancelled') {
          setPresetMessage({ type: 'error', text: result.error });
        }
        return;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(result.content);
      } catch {
        setPresetMessage({ type: 'error', text: 'Invalid JSON file.' });
        return;
      }
      const errors = validateAiCommandPreset(parsed);
      if (errors.length > 0) {
        setPresetMessage({ type: 'error', text: `Invalid preset: ${errors[0]!.message}` });
        return;
      }
      const preset = parsed as AiCommandPreset;
      let imported = 0;
      for (const cmd of preset.commands) {
        aiCommandStore.getState().register({
          id: `preset:${cmd.id}`,
          pluginId: '__preset',
          name: cmd.name,
          description: cmd.description,
          systemPrompt: cmd.systemPrompt,
          userPromptTemplate: cmd.userPromptTemplate,
          icon: cmd.icon,
          outputTarget: cmd.outputTarget,
          category: cmd.category,
        });
        imported++;
      }
      setPresetMessage({
        type: 'success',
        text: `Imported ${imported} command(s) from "${preset.name}".`,
      });
    } catch (err) {
      setPresetMessage({ type: 'error', text: err instanceof Error ? err.message : String(err) });
    }
  }, []);

  return (
    <SettingsPage
      title="AI Assistant"
      lede="Dripnex AI is included with your account — no key. Other clouds still require a one-time key until those providers open a public OAuth for apps. Keys stay in the keychain. Ollama never leaves this machine."
    >
      {PROVIDER_GROUPS.map(group => {
        const items = PROVIDER_CATALOG.filter(item => group.kinds.includes(item.kind));
        if (items.length === 0) return null;
        return (
          <section key={group.title} className={cardStyles.group}>
            <h3 className={cardStyles.groupTitle}>{group.title}</h3>
            <div className={cardStyles.list}>
              {items.map(item => {
                const active = item.id === currentProvider;
                const status =
                  connectStatus[item.id] ?? (item.id === 'dripnex' ? 'unavailable' : 'idle');
                const connected = status === 'connected';
                const unavailable = status === 'unavailable';
                const badge = connected
                  ? item.kind === 'included'
                    ? 'Authorized'
                    : 'Connected'
                  : unavailable
                    ? 'Not in this build'
                    : status === 'error'
                      ? 'Failed'
                      : 'Not connected';
                const tone = connected
                  ? 'ok'
                  : status === 'error'
                    ? 'warn'
                    : unavailable
                      ? 'muted'
                      : 'idle';
                return (
                  <SettingsCard
                    key={item.id}
                    flush
                    active={active}
                    tone={connected && active ? 'ok' : tone}
                    onClick={() => {
                      if (!active) selectProvider(item.id);
                    }}
                  >
                    <div className={cardStyles.top}>
                      <ProviderMark id={item.id} />
                      <div className={cardStyles.copy}>
                        <div className={cardStyles.nameRow}>
                          <h3 className={cardStyles.name}>{item.name}</h3>
                          <span className={cardStyles.kind}>{kindLabel(item.kind)}</span>
                          <span className={cardStyles.badge} data-tone={tone}>
                            {badge}
                          </span>
                        </div>
                        <p className={cardStyles.desc}>{item.description}</p>
                      </div>
                    </div>

                    {active ? (
                      <div className={cardStyles.body} onClick={event => event.stopPropagation()}>
                        <p className={cardStyles.hint}>
                          {unavailable && item.unavailableHint ? item.unavailableHint : item.hint}
                        </p>

                        {item.kind === 'included' && connected ? (
                          <p className={cardStyles.hint}>
                            Authorized with this Dripnex account. No key to paste.
                          </p>
                        ) : null}

                        {item.kind === 'cloud' ? (
                          <ProviderConnect
                            item={item}
                            connected={connected}
                            connecting={isConnecting}
                            storedKey={ai.apiKey}
                            error={connectError || hydrationError}
                            value={apiKeyInput}
                            onChange={next => {
                              setApiKeyInput(next);
                              setConnectError('');
                            }}
                            onConnect={() => void handleConnect()}
                            onDisconnect={() => void handleDisconnect()}
                          />
                        ) : null}

                        {item.id === 'ollama' ? (
                          <OllamaConnect
                            url={ai.baseUrl ?? ''}
                            connecting={isConnecting}
                            connected={connected}
                            error={connectError}
                            onUrlChange={next => updateAi({ baseUrl: next })}
                            onConnect={() => void handleConnect()}
                          />
                        ) : null}
                      </div>
                    ) : null}
                  </SettingsCard>
                );
              })}
            </div>
          </section>
        );
      })}

      <SettingGroup title="Next edit suggestions">
        <SettingSelect
          label="Trigger"
          description="Ghost text at the cursor from your AI provider. Tab accepts, Escape dismisses. Alt+\ asks on demand."
          htmlFor="nesMode"
          value={ai.nesMode ?? 'manual'}
          onChange={value => {
            const nesMode =
              value === 'automatic' || value === 'disabled' || value === 'manual'
                ? value
                : 'manual';
            updateAi({ nesMode });
          }}
          options={[
            { value: 'manual', label: 'Manual (Alt+\\)' },
            { value: 'automatic', label: 'Automatic (on idle)' },
            { value: 'disabled', label: 'Disabled' },
          ]}
        />
      </SettingGroup>

      <SettingGroup title="Knowledge base">
        <SettingRow label="Local index" description={kbIndexDescription(kb?.embedded ?? 0)}>
          <div
            className={styles.statusBadge}
            data-tone={kb && kb.embedded > 0 ? 'ok' : kb ? 'warn' : undefined}
          >
            {kbStatusLabel(kb, !window.dripnex?.ai)}
          </div>
        </SettingRow>
        <SettingSelect
          label="Embed provider"
          description="Ollama stays on this machine. OpenAI uses the key from the OpenAI card."
          htmlFor="embedProvider"
          value={embedProvider}
          onChange={value => {
            const provider = value === 'openai' ? 'openai' : 'ollama';
            const models = embedCatalog.find(item => item.id === provider)?.models ?? [];
            const nextModel = models.some(model => model.id === embedModel)
              ? embedModel
              : (models[0]?.id ?? embedModel);
            void applyEmbed({ embedProvider: provider, embedModel: nextModel });
          }}
          options={
            embedCatalog.length > 0
              ? embedCatalog.map(item => ({ value: item.id, label: item.displayName }))
              : [
                  { value: 'ollama', label: 'Ollama (Local)' },
                  { value: 'openai', label: 'OpenAI' },
                ]
          }
        />
        <SettingSelect
          label="Embedding model"
          description="Changing model rebuilds vectors for Ask Notes. Old vectors are dropped."
          htmlFor="embedModel"
          value={embedModel}
          onChange={value => {
            void applyEmbed({ embedProvider, embedModel: value });
          }}
          options={
            embedModelOptions.length > 0
              ? embedModelOptions
              : [{ value: embedModel, label: embedModel }]
          }
        />
        <SettingRow label="Index now" description="Embed passages that are still waiting">
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw size={14} />}
            disabled={typeof window.dripnex.ai.kbReindex !== 'function'}
            onClick={() => {
              void window.dripnex.ai.kbReindex?.().then(() => refreshKb());
            }}
          >
            Index
          </Button>
        </SettingRow>
      </SettingGroup>

      {isConnected ? (
        <SettingGroup title="Model">
          <SettingSelect
            label="Model"
            description={`Used when chatting with ${catalog.name}`}
            htmlFor="aiModel"
            value={ai.model}
            onChange={value => updateAi({ model: value })}
            options={
              modelOptions.length > 0
                ? modelOptions
                : [{ value: ai.model || 'default', label: 'No models found' }]
            }
          />
          <SettingNumber
            label="Max context notes"
            description="How many notes Ask Notes may pull in"
            htmlFor="aiMaxContextNotes"
            value={ai.maxContextNotes}
            onChange={value => updateAi({ maxContextNotes: value })}
            min={1}
            max={20}
            step={1}
          />
        </SettingGroup>
      ) : null}

      <SettingGroup title="AI Command Presets">
        <SettingRow label="Import Preset" description="Load AI commands from a JSON file">
          <Button
            variant="secondary"
            size="sm"
            icon={<Upload size={14} />}
            onClick={() => void handleImportPreset()}
          >
            Import
          </Button>
        </SettingRow>
        <SettingRow label="Export Preset" description="Save AI commands to a shareable file">
          <Button
            variant="secondary"
            size="sm"
            icon={<Download size={14} />}
            onClick={() => void handleExportPreset()}
            disabled={registeredAiCommands.length === 0}
          >
            Export
          </Button>
        </SettingRow>
        {presetMessage?.type === 'success' && (
          <div className={styles.successMessage}>
            <span className={styles.aiMessageIcon}>
              <CheckCircle size={14} />
              {presetMessage.text}
            </span>
          </div>
        )}
        {presetMessage?.type === 'error' && (
          <div className={styles.errorMessage}>
            <span className={styles.aiMessageIcon}>
              <XCircle size={14} />
              {presetMessage.text}
            </span>
          </div>
        )}
        {registeredAiCommands.length > 0 && (
          <div className={styles.aiCommandListWrapper}>
            <div className={styles.aiCommandListTitle}>
              Registered AI Commands ({registeredAiCommands.length})
            </div>
            <div className={styles.aiCommandList}>
              {registeredAiCommands.map(cmd => (
                <div key={cmd.id} className={styles.aiCommandItem}>
                  <span className={styles.aiCommandName}>{cmd.name}</span>
                  <span className={styles.aiCommandPlugin}>{cmd.pluginId}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </SettingGroup>
    </SettingsPage>
  );
}
