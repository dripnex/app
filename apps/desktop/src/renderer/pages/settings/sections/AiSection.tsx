/**
 * AI Assistant Settings Section
 *
 * API key configuration, model selection, and connection testing.
 */

import { useState, useCallback } from 'react';
import { Eye, EyeOff, Zap, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { useSettingsStore, selectAi } from '../../../stores/settings';
import { SettingGroup } from '../components/SettingGroup';
import { SettingRow } from '../components/SettingRow';
import { Select, NumberInput } from '../components/controls';
import styles from './Section.module.css';

type TestStatus = 'idle' | 'testing' | 'success' | 'error';

export function AiSection() {
  const ai = useSettingsStore(selectAi);
  const updateAi = useSettingsStore(s => s.updateAi);

  const [showKey, setShowKey] = useState(false);
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [testMessage, setTestMessage] = useState('');

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
      const result = await window.readied.ai.query({
        apiKey: ai.apiKey,
        model: ai.model,
        system: 'You are a helpful assistant. Respond with exactly: "Connection successful."',
        messages: [{ role: 'user', content: 'Test connection.' }],
        maxTokens: 32,
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
  }, [ai.apiKey, ai.model]);

  return (
    <div className={styles.section}>
      <h2 className={styles.title}>AI Assistant</h2>

      <SettingGroup title="API Configuration">
        <SettingRow
          label="API Key"
          description="Your Anthropic API key from console.anthropic.com"
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
                model: value as 'claude-sonnet-4-20250514' | 'claude-opus-4-20250514',
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
    </div>
  );
}
