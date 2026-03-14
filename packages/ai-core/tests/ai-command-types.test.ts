import { describe, it, expect } from 'vitest';
import {
  resolveTemplate,
  validateAiCommandDefinition,
  validateAiCommandPreset,
  serializePreset,
  parsePreset,
} from '../src/ai-command-types';
import type { AiCommandDefinition, AiCommandPreset } from '../src/ai-command-types';

// ---------------------------------------------------------------------------
// resolveTemplate
// ---------------------------------------------------------------------------

describe('resolveTemplate', () => {
  it('replaces {{selection}} placeholder', () => {
    expect(resolveTemplate('Fix: {{selection}}', { selection: 'hello world' })).toBe(
      'Fix: hello world'
    );
  });

  it('replaces {{note}} placeholder', () => {
    expect(resolveTemplate('Note: {{note}}', { note: 'full note content' })).toBe(
      'Note: full note content'
    );
  });

  it('replaces {{title}} placeholder', () => {
    expect(resolveTemplate('Title: {{title}}', { title: 'My Note' })).toBe('Title: My Note');
  });

  it('replaces multiple placeholders', () => {
    const result = resolveTemplate('In "{{title}}", rewrite: {{selection}}', {
      title: 'Draft',
      selection: 'some text',
    });
    expect(result).toBe('In "Draft", rewrite: some text');
  });

  it('replaces missing context with empty string', () => {
    expect(resolveTemplate('Selection: {{selection}}', {})).toBe('Selection: ');
  });

  it('leaves unknown placeholders as-is', () => {
    expect(resolveTemplate('{{unknown}} text', {})).toBe('{{unknown}} text');
  });

  it('handles template with no placeholders', () => {
    expect(resolveTemplate('plain text', { selection: 'ignored' })).toBe('plain text');
  });
});

// ---------------------------------------------------------------------------
// validateAiCommandDefinition
// ---------------------------------------------------------------------------

describe('validateAiCommandDefinition', () => {
  const validCommand: AiCommandDefinition = {
    id: 'fix-grammar',
    name: 'Fix Grammar',
    systemPrompt: 'You are a grammar expert.',
    userPromptTemplate: 'Fix the grammar: {{selection}}',
  };

  it('returns no errors for a valid command', () => {
    expect(validateAiCommandDefinition(validCommand)).toEqual([]);
  });

  it('requires id', () => {
    const errors = validateAiCommandDefinition({ ...validCommand, id: '' });
    expect(errors.some(e => e.field === 'id')).toBe(true);
  });

  it('rejects invalid id characters', () => {
    const errors = validateAiCommandDefinition({ ...validCommand, id: 'has spaces!' });
    expect(errors.some(e => e.field === 'id')).toBe(true);
  });

  it('allows colons, dots, and hyphens in id', () => {
    const errors = validateAiCommandDefinition({ ...validCommand, id: 'plugin:fix-grammar.v2' });
    expect(errors).toEqual([]);
  });

  it('requires name', () => {
    const errors = validateAiCommandDefinition({ ...validCommand, name: '' });
    expect(errors.some(e => e.field === 'name')).toBe(true);
  });

  it('requires systemPrompt', () => {
    const errors = validateAiCommandDefinition({ ...validCommand, systemPrompt: '' });
    expect(errors.some(e => e.field === 'systemPrompt')).toBe(true);
  });

  it('requires userPromptTemplate', () => {
    const errors = validateAiCommandDefinition({ ...validCommand, userPromptTemplate: '' });
    expect(errors.some(e => e.field === 'userPromptTemplate')).toBe(true);
  });

  it('validates outputTarget enum', () => {
    const errors = validateAiCommandDefinition({ ...validCommand, outputTarget: 'invalid' });
    expect(errors.some(e => e.field === 'outputTarget')).toBe(true);
  });

  it('accepts valid outputTarget values', () => {
    for (const target of ['replace', 'insert', 'panel']) {
      const errors = validateAiCommandDefinition({ ...validCommand, outputTarget: target });
      expect(errors).toEqual([]);
    }
  });

  it('returns error for non-object input', () => {
    const errors = validateAiCommandDefinition(null);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.field).toBe('root');
  });
});

// ---------------------------------------------------------------------------
// validateAiCommandPreset
// ---------------------------------------------------------------------------

describe('validateAiCommandPreset', () => {
  const validPreset: AiCommandPreset = {
    name: 'Writing Tools',
    version: '1.0.0',
    commands: [
      {
        id: 'fix-grammar',
        name: 'Fix Grammar',
        systemPrompt: 'You are a grammar expert.',
        userPromptTemplate: 'Fix: {{selection}}',
      },
    ],
  };

  it('returns no errors for a valid preset', () => {
    expect(validateAiCommandPreset(validPreset)).toEqual([]);
  });

  it('requires name', () => {
    const errors = validateAiCommandPreset({ ...validPreset, name: '' });
    expect(errors.some(e => e.field === 'name')).toBe(true);
  });

  it('requires version', () => {
    const errors = validateAiCommandPreset({ ...validPreset, version: '' });
    expect(errors.some(e => e.field === 'version')).toBe(true);
  });

  it('requires commands array', () => {
    const errors = validateAiCommandPreset({ ...validPreset, commands: 'not an array' });
    expect(errors.some(e => e.field === 'commands')).toBe(true);
  });

  it('rejects empty commands array', () => {
    const errors = validateAiCommandPreset({ ...validPreset, commands: [] });
    expect(errors.some(e => e.message.includes('must not be empty'))).toBe(true);
  });

  it('validates individual commands', () => {
    const errors = validateAiCommandPreset({
      ...validPreset,
      commands: [{ id: '', name: '', systemPrompt: '', userPromptTemplate: '' }],
    });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.field).toMatch(/^commands\[0\]/);
  });

  it('detects duplicate command ids', () => {
    const errors = validateAiCommandPreset({
      ...validPreset,
      commands: [validPreset.commands[0]!, validPreset.commands[0]!],
    });
    expect(errors.some(e => e.message.includes('Duplicate'))).toBe(true);
  });

  it('returns error for non-object input', () => {
    const errors = validateAiCommandPreset('string');
    expect(errors).toHaveLength(1);
    expect(errors[0]!.field).toBe('root');
  });
});

// ---------------------------------------------------------------------------
// serializePreset / parsePreset
// ---------------------------------------------------------------------------

describe('serializePreset / parsePreset', () => {
  const preset: AiCommandPreset = {
    name: 'Test',
    version: '1.0.0',
    commands: [
      {
        id: 'test-cmd',
        name: 'Test Command',
        systemPrompt: 'system',
        userPromptTemplate: '{{selection}}',
      },
    ],
  };

  it('round-trips a preset through serialize/parse', () => {
    const json = serializePreset(preset);
    const parsed = parsePreset(json);
    expect(parsed).toEqual(preset);
  });

  it('produces valid JSON', () => {
    const json = serializePreset(preset);
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it('parsePreset throws on invalid JSON', () => {
    expect(() => parsePreset('not json')).toThrow();
  });
});
