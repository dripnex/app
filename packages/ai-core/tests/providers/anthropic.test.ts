// packages/ai-core/tests/providers/anthropic.test.ts
import { describe, it, expect, vi } from 'vitest';
import { AnthropicProvider } from '../../src/providers/anthropic';
import type { LLMEvent, ChatOptions } from '../../src/types';
import type { ProviderConfig, FetchFn } from '../../src/provider';

function createMockFetch(sseChunks: string[], status = 200): FetchFn {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    text: async () => 'error body',
    body: new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        for (const chunk of sseChunks) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      },
    }),
  });
}

const defaultOptions: ChatOptions = {
  model: 'claude-sonnet-4-20250514',
  system: 'You are helpful.',
  messages: [{ role: 'user', content: 'Hello' }],
  maxTokens: 1024,
};

const defaultConfig: ProviderConfig = { apiKey: 'test-key' };

async function collectEvents(
  provider: AnthropicProvider,
  opts = defaultOptions,
  config = defaultConfig
): Promise<LLMEvent[]> {
  const events: LLMEvent[] = [];
  for await (const event of provider.chat(opts, config)) {
    events.push(event);
  }
  return events;
}

describe('AnthropicProvider', () => {
  it('has correct id and displayName', () => {
    const provider = new AnthropicProvider(createMockFetch([]));
    expect(provider.id).toBe('anthropic');
    expect(provider.displayName).toBe('Anthropic Claude');
  });

  it('normalizes text deltas from SSE', async () => {
    const sse = [
      'event: message_start\ndata: {"type":"message_start","message":{"id":"msg_1","model":"claude-sonnet-4-20250514","usage":{"input_tokens":10,"output_tokens":0}}}\n\n',
      'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}\n\n',
      'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" world"}}\n\n',
      'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":5}}\n\n',
      'event: message_stop\ndata: {"type":"message_stop"}\n\n',
    ];

    const provider = new AnthropicProvider(createMockFetch(sse));
    const events = await collectEvents(provider);

    const textEvents = events.filter(e => e.type === 'text');
    expect(textEvents).toHaveLength(2);
    expect((textEvents[0] as Extract<LLMEvent, { type: 'text' }>).delta).toBe('Hello');
    expect((textEvents[1] as Extract<LLMEvent, { type: 'text' }>).delta).toBe(' world');
  });

  it('emits usage event from message_delta', async () => {
    const sse = [
      'event: message_start\ndata: {"type":"message_start","message":{"id":"msg_1","model":"claude-sonnet-4-20250514","usage":{"input_tokens":100,"output_tokens":0}}}\n\n',
      'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":50}}\n\n',
      'event: message_stop\ndata: {"type":"message_stop"}\n\n',
    ];

    const provider = new AnthropicProvider(createMockFetch(sse));
    const events = await collectEvents(provider);

    const usageEvent = events.find(e => e.type === 'usage');
    expect(usageEvent).toBeDefined();
    if (usageEvent?.type === 'usage') {
      expect(usageEvent.inputTokens).toBe(100);
      expect(usageEvent.outputTokens).toBe(50);
    }
  });

  it('emits error on non-ok response', async () => {
    const fetchFn = createMockFetch([], 429);
    const provider = new AnthropicProvider(fetchFn);
    const events = await collectEvents(provider);

    const errorEvent = events.find(e => e.type === 'error');
    expect(errorEvent).toBeDefined();
    if (errorEvent?.type === 'error') {
      expect(errorEvent.code).toBe('rate_limit');
      expect(errorEvent.retryable).toBe(true);
    }
  });

  it('emits error on 401', async () => {
    const fetchFn = createMockFetch([], 401);
    const provider = new AnthropicProvider(fetchFn);
    const events = await collectEvents(provider);

    const errorEvent = events.find(e => e.type === 'error');
    if (errorEvent?.type === 'error') {
      expect(errorEvent.code).toBe('auth_failed');
      expect(errorEvent.retryable).toBe(false);
    }
  });

  it('sends correct headers and body', async () => {
    const fetchFn = createMockFetch(['event: message_stop\ndata: {"type":"message_stop"}\n\n']);
    const provider = new AnthropicProvider(fetchFn);
    await collectEvents(provider);

    expect(fetchFn).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'x-api-key': 'test-key',
          'anthropic-version': '2023-06-01',
        }),
      })
    );
  });

  it('validates config with missing API key', async () => {
    const provider = new AnthropicProvider(createMockFetch([]));
    const result = await provider.validate({ apiKey: '' });
    expect(result.ok).toBe(false);
  });

  it('lists static models', async () => {
    const provider = new AnthropicProvider(createMockFetch([]));
    const models = await provider.listModels({});
    expect(models.length).toBeGreaterThan(0);
    expect(models.some(m => m.id.includes('sonnet'))).toBe(true);
  });
});
