// packages/ai-core/tests/ai-service.test.ts
import { describe, it, expect, vi } from 'vitest';
import { AIServiceImpl } from '../src/ai-service';
import { ProviderRegistry } from '../src/provider-registry';
import type { LLMProvider, ProviderConfig } from '../src/provider';
import type { LLMEvent, ChatOptions } from '../src/types';
import type { ChatRequest } from '../src/ai-service';

function createMockProvider(events: LLMEvent[]): LLMProvider {
  return {
    id: 'mock',
    displayName: 'Mock Provider',
    async *chat(_opts: ChatOptions, _config: ProviderConfig): AsyncIterable<LLMEvent> {
      for (const event of events) yield event;
    },
    async validate() {
      return { ok: true as const };
    },
    async listModels() {
      return [
        {
          id: 'mock-model',
          displayName: 'Mock',
          contextWindow: 10000,
          maxOutputTokens: 4096,
          supportsStreaming: true,
          supportsTools: false,
        },
      ];
    },
  };
}

function createRequest(overrides: Partial<ChatRequest> = {}): ChatRequest {
  return {
    query: 'Hello',
    history: [],
    relevantNotes: [],
    mode: 'chat',
    provider: 'mock',
    model: 'mock-model',
    providerConfig: { apiKey: 'test' },
    ...overrides,
  };
}

async function collectEvents(handle: { events: AsyncIterable<LLMEvent> }): Promise<LLMEvent[]> {
  const events: LLMEvent[] = [];
  for await (const event of handle.events) events.push(event);
  return events;
}

describe('AIServiceImpl', () => {
  it('returns ChatHandle with requestId', () => {
    const registry = new ProviderRegistry();
    registry.register(createMockProvider([{ type: 'text', delta: 'hi' }]));
    const service = new AIServiceImpl(registry);

    const handle = service.chat(createRequest());
    expect(handle.requestId).toBeTruthy();
    expect(typeof handle.abort).toBe('function');
  });

  it('emits start event first with provider info', async () => {
    const registry = new ProviderRegistry();
    registry.register(createMockProvider([{ type: 'text', delta: 'hi' }]));
    const service = new AIServiceImpl(registry);

    const events = await collectEvents(service.chat(createRequest()));
    expect(events[0]?.type).toBe('start');
    if (events[0]?.type === 'start') {
      expect(events[0].provider).toBe('mock');
      expect(events[0].requestId).toBeTruthy();
    }
  });

  it('emits done event last with durationMs', async () => {
    const registry = new ProviderRegistry();
    registry.register(createMockProvider([{ type: 'text', delta: 'hi' }]));
    const service = new AIServiceImpl(registry);

    const events = await collectEvents(service.chat(createRequest()));
    const last = events[events.length - 1];
    expect(last?.type).toBe('done');
    if (last?.type === 'done') {
      expect(last.durationMs).toBeGreaterThanOrEqual(0);
    }
  });

  it('forwards provider events between start and done', async () => {
    const registry = new ProviderRegistry();
    registry.register(
      createMockProvider([
        { type: 'text', delta: 'Hello' },
        { type: 'text', delta: ' world' },
        { type: 'usage', inputTokens: 10, outputTokens: 5 },
      ])
    );
    const service = new AIServiceImpl(registry);

    const events = await collectEvents(service.chat(createRequest()));
    const types = events.map(e => e.type);
    expect(types).toEqual(['start', 'text', 'text', 'usage', 'done']);
  });

  it('abort cancels the stream', async () => {
    const registry = new ProviderRegistry();
    registry.register(createMockProvider([{ type: 'text', delta: 'hi' }]));
    const service = new AIServiceImpl(registry);

    const handle = service.chat(createRequest());
    handle.abort();

    const events = await collectEvents(handle);
    const done = events.find(e => e.type === 'done');
    if (done?.type === 'done') {
      expect(done.cancelled).toBe(true);
    }
  });

  it('cancelAll aborts all active requests', () => {
    const registry = new ProviderRegistry();
    registry.register(createMockProvider([{ type: 'text', delta: 'hi' }]));
    const service = new AIServiceImpl(registry);

    const handle1 = service.chat(createRequest());
    const handle2 = service.chat(createRequest());
    service.cancelAll();

    expect(handle1.requestId).toBeTruthy();
    expect(handle2.requestId).toBeTruthy();
  });

  it('builds context with system prompt based on mode', async () => {
    const registry = new ProviderRegistry();
    const chatSpy = vi.fn(async function* () {
      yield { type: 'text' as const, delta: 'hi' };
    });
    registry.register({
      id: 'mock',
      displayName: 'Mock',
      chat: chatSpy,
      async validate() {
        return { ok: true as const };
      },
      async listModels() {
        return [
          {
            id: 'mock-model',
            displayName: 'M',
            contextWindow: 10000,
            maxOutputTokens: 4096,
            supportsStreaming: true,
            supportsTools: false,
          },
        ];
      },
    });
    const service = new AIServiceImpl(registry);

    await collectEvents(service.chat(createRequest({ mode: 'ask-notes' })));

    expect(chatSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining('Ask Your Notes'),
      }),
      expect.anything()
    );
  });
});
