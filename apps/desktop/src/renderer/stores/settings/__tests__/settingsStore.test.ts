import { describe, it, expect } from 'vitest';
import { DEFAULT_AI, DEFAULT_SETTINGS } from '../schema';
import { partializeSettings, useSettingsStore } from '../settingsStore';

describe('settingsStore persistence', () => {
  it('partialize keeps the provider and strips the API key', () => {
    const state = {
      ...useSettingsStore.getState(),
      settings: {
        ...DEFAULT_SETTINGS,
        ai: {
          ...DEFAULT_AI,
          provider: 'anthropic' as const,
          apiKey: 'sk-secret-must-not-persist',
        },
      },
    };

    const partial = partializeSettings(state);

    expect(partial.settings.ai.provider).toBe('anthropic');
    expect(partial.settings.ai.apiKey).toBe('');
    expect(JSON.stringify(partial)).not.toContain('sk-secret');
  });

  it('defaults MCP off and keeps integrations through persist', () => {
    expect(DEFAULT_SETTINGS.integrations).toEqual({
      mcpEnabled: false,
      mcpWrites: false,
    });
    const partial = partializeSettings(useSettingsStore.getState());
    expect(partial.settings.integrations.mcpEnabled).toBe(false);
    expect(partial.settings.integrations.mcpWrites).toBe(false);
  });
});
