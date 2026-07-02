/**
 * AI Assistant Settings Section
 *
 * Provider connection with "Connect" flow, model selection,
 * and AI command preset management.
 */

import { useState, useCallback, useEffect, useSyncExternalStore } from 'react';
import { CheckCircle, XCircle, Upload, Download, ExternalLink, Unplug, Plug } from 'lucide-react';
import { aiCommandStore } from '@dripnex/plugin-api';
import type { AiCommandRegistration } from '@dripnex/plugin-api';
import { validateAiCommandPreset, serializePreset } from '@dripnex/ai-core';
import type { AiCommandPreset } from '@dripnex/ai-core';
import { useSettingsStore, selectAi } from '../../../stores/settings';
import { SettingGroup } from '../components/SettingGroup';
import { SettingRow } from '../components/SettingRow';
import { Select, NumberInput } from '../components/controls';
import { Button } from '../../../ui/primitives';
import styles from './Section.module.css';

type ConnectStatus = 'idle' | 'connecting' | 'connected' | 'error';

const PROVIDER_INFO: Record<
  string,
  { name: string; keyUrl: string; placeholder: string; description: string }
> = {
  anthropic: {
    name: 'Anthropic',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    placeholder: 'sk-ant-api03-...',
    description: 'Claude models — Sonnet, Opus, Haiku',
  },
  openai: {
    name: 'OpenAI',
    keyUrl: 'https://platform.openai.com/api-keys',
    placeholder: 'sk-proj-...',
    description: 'GPT-4o, o1, GPT-4 Turbo',
  },
  ollama: {
    name: 'Ollama',
    keyUrl: '',
    placeholder: 'http://localhost:11434',
    description: 'Local models — no API key needed',
  },
};

const MODEL_OPTIONS: Record<string, Array<{ value: string; label: string }>> = {
  anthropic: [
    { value: 'claude-sonnet-5', label: 'Claude Sonnet 5' },
    { value: 'claude-opus-4-8', label: 'Claude Opus 4.8' },
    { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
  ],
  openai: [
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'o1', label: 'o1' },
    { value: 'o1-mini', label: 'o1 Mini' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  ],
  ollama: [],
};

function useAiCommands(): AiCommandRegistration[] {
  return useSyncExternalStore(
    cb => aiCommandStore.subscribe(cb),
    () => aiCommandStore.getState().registrations
  );
}

export function AiSection() {
  const ai = useSettingsStore(selectAi);
  const updateAi = useSettingsStore(s => s.updateAi);

  const [connectStatus, setConnectStatus] = useState<Record<string, ConnectStatus>>({});
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [connectError, setConnectError] = useState('');
  const [ollamaModels, setOllamaModels] = useState<Array<{ value: string; label: string }>>([]);
  const [presetMessage, setPresetMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const registeredAiCommands = useAiCommands();

  // Load connected providers on mount
  useEffect(() => {
    async function loadConnected() {
      const providers = await window.dripnex.ai.listConnectedProviders();
      const status: Record<string, ConnectStatus> = {};
      for (const p of providers) {
        status[p] = 'connected';
      }
      // Ollama is "connected" if reachable (no key needed)
      if (!status.ollama) {
        try {
          const result = await window.dripnex.ai.validate({ provider: 'ollama', apiKey: '' });
          if (result.ok) status.ollama = 'connected';
        } catch {
          // Ollama not running
        }
      }
      setConnectStatus(status);
    }
    void loadConnected();
  }, []);

  // Fetch Ollama models when it's connected
  useEffect(() => {
    if (ai.provider === 'ollama' && connectStatus.ollama === 'connected') {
      window.dripnex.ai
        .validate({ provider: 'ollama', apiKey: '' })
        .then(() => {
          // TODO: fetch models via a dedicated IPC. For now, use common defaults
          setOllamaModels([
            { value: 'llama3.1', label: 'Llama 3.1' },
            { value: 'llama3.2', label: 'Llama 3.2' },
            { value: 'mistral', label: 'Mistral' },
            { value: 'codellama', label: 'Code Llama' },
            { value: 'gemma2', label: 'Gemma 2' },
          ]);
        })
        .catch(() => setOllamaModels([]));
    }
  }, [ai.provider, connectStatus.ollama]);

  const currentProvider = ai.provider;
  const providerInfo = (PROVIDER_INFO[currentProvider] ?? PROVIDER_INFO.anthropic) as {
    name: string;
    keyUrl: string;
    placeholder: string;
    description: string;
  };
  const isConnected = connectStatus[currentProvider] === 'connected';
  const isConnecting = connectStatus[currentProvider] === 'connecting';

  const modelOptions: Array<{ value: string; label: string }> =
    currentProvider === 'ollama'
      ? ollamaModels
      : (MODEL_OPTIONS[currentProvider] ?? MODEL_OPTIONS.anthropic!);

  const handleConnect = useCallback(async () => {
    if (currentProvider === 'ollama') {
      // Ollama doesn't need a key, just validate connection
      setConnectStatus(prev => ({ ...prev, ollama: 'connecting' }));
      setConnectError('');
      try {
        const result = await window.dripnex.ai.validate({
          provider: 'ollama',
          apiKey: '',
        });
        if (result.ok) {
          setConnectStatus(prev => ({ ...prev, ollama: 'connected' }));
        } else {
          setConnectStatus(prev => ({ ...prev, ollama: 'error' }));
          setConnectError(result.error || 'Cannot connect to Ollama');
        }
      } catch (err) {
        setConnectStatus(prev => ({ ...prev, ollama: 'error' }));
        setConnectError(err instanceof Error ? err.message : 'Connection failed');
      }
      return;
    }

    if (!apiKeyInput.trim()) {
      setConnectError('Please paste your API key');
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
        // Save key securely
        await window.dripnex.ai.saveKey(currentProvider, apiKeyInput.trim());
        // Also update the settings store so existing chat flow works
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

  const handleOpenKeyPage = useCallback(() => {
    if (providerInfo.keyUrl) {
      window.open(providerInfo.keyUrl, '_blank');
    }
  }, [providerInfo.keyUrl]);

  // Load key into settings when switching providers
  useEffect(() => {
    async function loadKeyForProvider() {
      if (currentProvider === 'ollama') return;
      const key = await window.dripnex.ai.getKey(currentProvider);
      if (key) {
        updateAi({ apiKey: key });
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

  const providerOptions = [
    { value: 'anthropic', label: 'Anthropic' },
    { value: 'openai', label: 'OpenAI' },
    { value: 'ollama', label: 'Ollama (Local)' },
  ];

  return (
    <div className={styles.section}>
      <h2 className={styles.title}>AI Assistant</h2>

      {/* ── Provider Selection ── */}
      <SettingGroup title="Provider">
        <SettingRow
          label="LLM Provider"
          description={providerInfo.description}
          htmlFor="aiProvider"
        >
          <Select
            id="aiProvider"
            value={ai.provider}
            onChange={value => {
              updateAi({ provider: value as 'anthropic' | 'openai' | 'ollama' });
              setConnectError('');
              setApiKeyInput('');
            }}
            options={providerOptions}
          />
        </SettingRow>
      </SettingGroup>

      {/* ── Connection ── */}
      <SettingGroup title="Connection">
        {isConnected ? (
          /* Connected state */
          <div className={styles.aiConnectionWrapper}>
            <div className={styles.aiConnectedBox}>
              <div className={styles.aiConnectedInfo}>
                <CheckCircle size={20} className={styles.aiConnectedIcon} />
                <div>
                  <div className={styles.aiConnectedTitle}>Connected to {providerInfo.name}</div>
                  <div className={styles.aiConnectedSubtitle}>
                    API key stored securely in your system keychain
                  </div>
                </div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                icon={<Unplug size={14} />}
                onClick={handleDisconnect}
              >
                Disconnect
              </Button>
            </div>
          </div>
        ) : (
          /* Not connected — show connect flow */
          <div className={styles.aiConnectionWrapper}>
            <div className={styles.aiConnectBox}>
              {currentProvider !== 'ollama' && (
                <>
                  <div className={styles.aiConnectHeader}>
                    <span className={styles.aiConnectLabel}>
                      Connect your {providerInfo.name} account
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<ExternalLink size={12} />}
                      onClick={handleOpenKeyPage}
                    >
                      Get API Key
                    </Button>
                  </div>
                  <div className={styles.aiKeyInputRow}>
                    <input
                      type="password"
                      value={apiKeyInput}
                      onChange={e => {
                        setApiKeyInput(e.target.value);
                        setConnectError('');
                      }}
                      placeholder={providerInfo.placeholder}
                      autoComplete="off"
                      spellCheck={false}
                      className={styles.aiKeyInput}
                      onKeyDown={e => {
                        if (e.key === 'Enter') void handleConnect();
                      }}
                    />
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<Plug size={14} />}
                      loading={isConnecting}
                      onClick={handleConnect}
                      disabled={isConnecting || !apiKeyInput.trim()}
                    >
                      {isConnecting ? 'Connecting...' : 'Connect'}
                    </Button>
                  </div>
                </>
              )}

              {currentProvider === 'ollama' && (
                <div className={styles.aiOllamaInfo}>
                  <div className={styles.aiOllamaDescription}>
                    Ollama runs locally — no API key needed. Make sure Ollama is running on your
                    machine.
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<Plug size={14} />}
                    loading={isConnecting}
                    onClick={handleConnect}
                  >
                    {isConnecting ? 'Connecting...' : 'Connect to Ollama'}
                  </Button>
                </div>
              )}

              {connectError && (
                <div className={styles.aiErrorBox}>
                  <XCircle size={14} />
                  {connectError}
                </div>
              )}
            </div>
          </div>
        )}
      </SettingGroup>

      {/* ── Model & Context ── */}
      {isConnected && (
        <SettingGroup title="Model">
          <SettingRow label="Model" description="AI model to use for queries" htmlFor="aiModel">
            <Select
              id="aiModel"
              value={ai.model}
              onChange={value => updateAi({ model: value })}
              options={modelOptions}
            />
          </SettingRow>

          <SettingRow
            label="Max Context Notes"
            description="Maximum notes to include as context in Ask Notes mode"
            htmlFor="aiMaxContextNotes"
          >
            <NumberInput
              id="aiMaxContextNotes"
              value={ai.maxContextNotes}
              onChange={value => updateAi({ maxContextNotes: value })}
              min={1}
              max={20}
              step={1}
            />
          </SettingRow>
        </SettingGroup>
      )}

      {/* ── Presets ── */}
      <SettingGroup title="AI Command Presets">
        <SettingRow label="Import Preset" description="Load AI commands from a JSON file">
          <Button
            variant="secondary"
            size="sm"
            icon={<Upload size={14} />}
            onClick={handleImportPreset}
          >
            Import
          </Button>
        </SettingRow>

        <SettingRow label="Export Preset" description="Save AI commands to a shareable file">
          <Button
            variant="secondary"
            size="sm"
            icon={<Download size={14} />}
            onClick={handleExportPreset}
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
    </div>
  );
}
