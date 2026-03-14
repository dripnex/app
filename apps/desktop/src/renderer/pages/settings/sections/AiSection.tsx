/**
 * AI Assistant Settings Section
 *
 * API key configuration, model selection, connection testing,
 * and AI command preset import/export.
 */

import { useState, useCallback, useSyncExternalStore } from 'react';
import { Eye, EyeOff, Zap, Loader2, CheckCircle, XCircle, Upload, Download } from 'lucide-react';
import { useSettingsStore, selectAi } from '../../../stores/settings';
import { SettingGroup } from '../components/SettingGroup';
import { SettingRow } from '../components/SettingRow';
import { Select, NumberInput } from '../components/controls';
import { aiCommandStore } from '@readied/plugin-api';
import type { AiCommandRegistration } from '@readied/plugin-api';
import { validateAiCommandPreset, serializePreset } from '@readied/ai-core';
import type { AiCommandPreset } from '@readied/ai-core';
import styles from './Section.module.css';

type TestStatus = 'idle' | 'testing' | 'success' | 'error';

/** Read the aiCommandStore registrations reactively */
function useAiCommands(): AiCommandRegistration[] {
  return useSyncExternalStore(
    cb => aiCommandStore.subscribe(cb),
    () => aiCommandStore.getState().registrations
  );
}

export function AiSection() {
  const ai = useSettingsStore(selectAi);
  const updateAi = useSettingsStore(s => s.updateAi);

  const [showKey, setShowKey] = useState(false);
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [testMessage, setTestMessage] = useState('');
  const [presetMessage, setPresetMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const registeredAiCommands = useAiCommands();

  const providerOptions = [
    { value: 'anthropic', label: 'Anthropic' },
    { value: 'openai', label: 'OpenAI' },
    { value: 'ollama', label: 'Ollama' },
  ];

  const modelOptions = [
    { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
    { value: 'claude-opus-4-20250514', label: 'Claude Opus 4' },
  ];

  const handleTestConnection = useCallback(async () => {
    if (!ai.apiKey) {
      setTestStatus('error');
      setTestMessage('Please enter an API key first.');
      return;
    }

    setTestStatus('testing');
    setTestMessage('');

    try {
      const result = await window.readied.ai.validate({
        provider: ai.provider,
        apiKey: ai.apiKey,
      });

      if (result.ok) {
        setTestStatus('success');
        setTestMessage('Connection successful. Your API key is valid.');
      } else {
        setTestStatus('error');
        setTestMessage(result.error || 'Unknown error occurred.');
      }
    } catch (err) {
      setTestStatus('error');
      setTestMessage(err instanceof Error ? err.message : String(err));
    }
  }, [ai.apiKey, ai.provider]);

  const handleExportPreset = useCallback(async () => {
    setPresetMessage(null);

    if (registeredAiCommands.length === 0) {
      setPresetMessage({
        type: 'error',
        text: 'No custom AI commands to export. Plugins must register commands first.',
      });
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
      const result = await window.readied.ai.exportPreset(serializePreset(preset));
      if (result.ok) {
        setPresetMessage({
          type: 'success',
          text: `Exported ${preset.commands.length} command(s).`,
        });
      } else {
        if (result.error !== 'Export cancelled') {
          setPresetMessage({ type: 'error', text: result.error });
        }
      }
    } catch (err) {
      setPresetMessage({ type: 'error', text: err instanceof Error ? err.message : String(err) });
    }
  }, [registeredAiCommands]);

  const handleImportPreset = useCallback(async () => {
    setPresetMessage(null);

    try {
      const result = await window.readied.ai.importPreset();
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
    <div className={styles.section}>
      <h2 className={styles.title}>AI Assistant</h2>

      <SettingGroup title="API Configuration">
        <SettingRow
          label="Provider"
          description="LLM provider to use for AI queries"
          htmlFor="aiProvider"
        >
          <Select
            id="aiProvider"
            value={ai.provider}
            onChange={value =>
              updateAi({
                provider: value as 'anthropic' | 'openai' | 'ollama',
              })
            }
            options={providerOptions}
          />
        </SettingRow>

        <SettingRow
          label="API Key"
          description="Your API key for the selected provider"
          htmlFor="aiApiKey"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type={showKey ? 'text' : 'password'}
              id="aiApiKey"
              value={ai.apiKey}
              onChange={e => updateAi({ apiKey: e.target.value })}
              placeholder="sk-ant-..."
              autoComplete="off"
              spellCheck={false}
              style={{
                width: '100%',
                maxWidth: 320,
                padding: '0.5rem 0.875rem',
                background: 'var(--bg-hover)',
                border: '1px solid var(--border-strong)',
                borderRadius: '0.5rem',
                color: 'var(--text-primary)',
                fontSize: '0.875rem',
                fontFamily: 'inherit',
                transition: 'all 0.2s ease',
              }}
            />
            <button
              type="button"
              onClick={() => setShowKey(prev => !prev)}
              title={showKey ? 'Hide API key' : 'Show API key'}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '2rem',
                height: '2rem',
                padding: 0,
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-strong)',
                borderRadius: '0.375rem',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </SettingRow>

        <SettingRow
          label="Model"
          description="Claude model to use for AI queries"
          htmlFor="aiModel"
        >
          <Select
            id="aiModel"
            value={ai.model}
            onChange={value =>
              updateAi({
                model: value,
              })
            }
            options={modelOptions}
          />
        </SettingRow>

        <SettingRow
          label="Max Context Notes"
          description="Maximum number of notes to include as context in AI queries"
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

      <SettingGroup title="Connection">
        <SettingRow
          label="Test Connection"
          description="Send a test query to verify your API key and model work correctly"
        >
          <button
            type="button"
            className={styles.actionButton}
            onClick={handleTestConnection}
            disabled={testStatus === 'testing' || !ai.apiKey}
          >
            {testStatus === 'testing' ? (
              <Loader2 size={14} className={styles.spinning} />
            ) : (
              <Zap size={14} />
            )}
            <span>{testStatus === 'testing' ? 'Testing...' : 'Test Connection'}</span>
          </button>
        </SettingRow>

        {testStatus === 'success' && (
          <div className={styles.successMessage}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle size={14} />
              {testMessage}
            </span>
          </div>
        )}

        {testStatus === 'error' && (
          <div className={styles.errorMessage}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <XCircle size={14} />
              {testMessage}
            </span>
          </div>
        )}
      </SettingGroup>

      <SettingGroup title="AI Command Presets">
        <SettingRow
          label="Import Preset"
          description="Load AI command definitions from a JSON file"
        >
          <button type="button" className={styles.actionButton} onClick={handleImportPreset}>
            <Upload size={14} />
            <span>Import</span>
          </button>
        </SettingRow>

        <SettingRow
          label="Export Preset"
          description="Save all registered AI commands to a shareable JSON file"
        >
          <button
            type="button"
            className={styles.actionButton}
            onClick={handleExportPreset}
            disabled={registeredAiCommands.length === 0}
          >
            <Download size={14} />
            <span>Export</span>
          </button>
        </SettingRow>

        {presetMessage?.type === 'success' && (
          <div className={styles.successMessage}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle size={14} />
              {presetMessage.text}
            </span>
          </div>
        )}

        {presetMessage?.type === 'error' && (
          <div className={styles.errorMessage}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <XCircle size={14} />
              {presetMessage.text}
            </span>
          </div>
        )}

        {registeredAiCommands.length > 0 && (
          <div style={{ padding: '0.75rem 1rem' }}>
            <div
              style={{
                fontSize: '0.8125rem',
                color: 'var(--text-secondary)',
                marginBottom: '0.5rem',
              }}
            >
              Registered AI Commands ({registeredAiCommands.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              {registeredAiCommands.map(cmd => (
                <div
                  key={cmd.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.375rem 0.75rem',
                    background: 'var(--bg-hover)',
                    borderRadius: '0.375rem',
                    fontSize: '0.8125rem',
                  }}
                >
                  <span style={{ color: 'var(--text-primary)' }}>{cmd.name}</span>
                  <span style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>
                    {cmd.pluginId}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </SettingGroup>
    </div>
  );
}
