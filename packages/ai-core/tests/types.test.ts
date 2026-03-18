// packages/ai-core/tests/types.test.ts
import { describe, it, expect } from 'vitest';
import type { LLMEvent, ChatMessage, ContentPart } from '../src/types';

describe('LLMEvent protocol', () => {
  it('discriminates events by type field', () => {
    const event: LLMEvent = { type: 'text', delta: 'hello' };
    expect(event.type).toBe('text');
    if (event.type === 'text') {
      expect(event.delta).toBe('hello');
    }
  });

  it('start event carries model, requestId, provider', () => {
    const event: LLMEvent = {
      type: 'start',
      model: 'claude-sonnet-4-20250514',
      requestId: 'abc-123',
      provider: 'anthropic',
    };
    expect(event.provider).toBe('anthropic');
  });

  it('error event carries typed code', () => {
    const event: LLMEvent = {
      type: 'error',
      code: 'rate_limit',
      error: 'Too many requests',
      retryable: true,
    };
    expect(event.code).toBe('rate_limit');
    expect(event.retryable).toBe(true);
  });

  it('done event carries durationMs and optional cancelled', () => {
    const event: LLMEvent = { type: 'done', durationMs: 1500 };
    expect(event.durationMs).toBe(1500);
    expect(event.cancelled).toBeUndefined();

    const cancelled: LLMEvent = { type: 'done', durationMs: 200, cancelled: true };
    expect(cancelled.cancelled).toBe(true);
  });

  it('events support metadata extension', () => {
    const event: LLMEvent = {
      type: 'text',
      delta: 'hi',
      metadata: { finishReason: 'stop', citations: ['note-1'] },
    };
    expect(event.metadata?.finishReason).toBe('stop');
  });

  it('usage event carries token counts', () => {
    const event: LLMEvent = {
      type: 'usage',
      inputTokens: 1500,
      outputTokens: 300,
    };
    expect(event.inputTokens).toBe(1500);
  });
});

describe('tool-use ContentPart variants', () => {
  it('accepts tool_use content part', () => {
    const part: ContentPart = {
      type: 'tool_use',
      id: 'call_123',
      name: 'search_notes',
      input: { query: 'react' },
    };
    expect(part.type).toBe('tool_use');
  });

  it('accepts tool_result content part', () => {
    const part: ContentPart = {
      type: 'tool_result',
      tool_use_id: 'call_123',
      content: '[]',
    };
    expect(part.type).toBe('tool_result');
  });

  it('accepts tool_result with is_error', () => {
    const part: ContentPart = {
      type: 'tool_result',
      tool_use_id: 'call_123',
      content: 'Tool failed',
      is_error: true,
    };
    expect(part.type).toBe('tool_result');
    if (part.type === 'tool_result') {
      expect(part.is_error).toBe(true);
    }
  });
});

describe('stop LLMEvent', () => {
  it('accepts stop event with tool_use reason', () => {
    const event: LLMEvent = { type: 'stop', reason: 'tool_use' };
    expect(event.type).toBe('stop');
  });

  it('accepts stop event with end_turn reason', () => {
    const event: LLMEvent = { type: 'stop', reason: 'end_turn' };
    expect(event.type).toBe('stop');
  });
});

describe('ChatMessage', () => {
  it('accepts string content (common case)', () => {
    const msg: ChatMessage = { role: 'user', content: 'hello' };
    expect(typeof msg.content).toBe('string');
  });

  it('accepts ContentPart array (multimodal future)', () => {
    const msg: ChatMessage = {
      role: 'user',
      content: [
        { type: 'text', text: 'Describe this' },
        { type: 'image', url: 'data:image/png;base64,...' },
      ],
    };
    expect(Array.isArray(msg.content)).toBe(true);
  });
});
