import { describe, it, expect, vi } from 'vitest';
import { runToolLoop } from '../src/tool-loop';
import type { ToolLoopOptions, ToolLoopEvent, ToolCall } from '../src/tool-loop';
import type { LLMEvent, ChatOptions } from '../src/types';
import type { LLMProvider, ProviderConfig } from '../src/provider';

type ChatFn = (opts: ChatOptions, config: ProviderConfig) => AsyncIterable<LLMEvent>;

function createMockProvider(chatSequence: LLMEvent[][]): LLMProvider {
  let callIndex = 0;
  return {
    id: 'mock',
    displayName: 'Mock',
    async *chat(_opts: ChatOptions, _config: ProviderConfig): AsyncIterable<LLMEvent> {
      const events = chatSequence[callIndex++] ?? [];
      for (const e of events) yield e;
    },
    async validate() {
      return { ok: true as const };
    },
    async listModels() {
      return [];
    },
  };
}

function baseOptions(
  provider: LLMProvider,
  overrides: Partial<ToolLoopOptions> = {}
): ToolLoopOptions {
  return {
    provider,
    providerConfig: { apiKey: 'test' },
    chatOptions: {
      model: 'mock',
      system: 'test',
      messages: [{ role: 'user', content: 'hello' }],
      maxTokens: 1024,
      tools: [{ name: 'search', description: 'Search', parameters: {} }],
    },
    maxRoundTrips: 5,
    signal: new AbortController().signal,
    executeTool: vi.fn().mockResolvedValue({ ok: true, content: 'result' }),
    ...overrides,
  };
}

async function collectEvents(opts: ToolLoopOptions): Promise<ToolLoopEvent[]> {
  const events: ToolLoopEvent[] = [];
  for await (const event of runToolLoop(opts)) events.push(event);
  return events;
}

describe('runToolLoop', () => {
  it('passes through events when no tool calls (end_turn)', async () => {
    const provider = createMockProvider([
      [
        { type: 'text', delta: 'Hello' },
        { type: 'stop', reason: 'end_turn' },
        { type: 'usage', inputTokens: 10, outputTokens: 5 },
      ],
    ]);

    const events = await collectEvents(baseOptions(provider));
    const types = events.map(e => e.type);
    expect(types).toContain('text');
    expect(types).toContain('stop');
    expect(types).not.toContain('tool_executing');
  });

  it('executes tool and re-sends on tool_use stop', async () => {
    const executeTool = vi.fn().mockResolvedValue({ ok: true, content: '[{"id":"1"}]' });

    const provider = createMockProvider([
      // Round 1: model calls a tool
      [
        { type: 'text', delta: 'Let me search.' },
        { type: 'tool_call', id: 'tc_1', name: 'search', args: { query: 'test' } },
        { type: 'stop', reason: 'tool_use' },
        { type: 'usage', inputTokens: 10, outputTokens: 20 },
      ],
      // Round 2: model responds with text
      [
        { type: 'text', delta: 'Found results.' },
        { type: 'stop', reason: 'end_turn' },
        { type: 'usage', inputTokens: 30, outputTokens: 10 },
      ],
    ]);

    const events = await collectEvents(baseOptions(provider, { executeTool }));
    const types = events.map(e => e.type);

    expect(types).toContain('tool_executing');
    expect(types).toContain('tool_complete');
    expect(types).toContain('round_trip');
    expect(executeTool).toHaveBeenCalledWith({
      id: 'tc_1',
      name: 'search',
      args: { query: 'test' },
    });
  });

  it('respects maxRoundTrips limit', async () => {
    // Every call returns a tool_call
    const infiniteToolCalls: LLMEvent[] = [
      { type: 'tool_call', id: 'tc', name: 'search', args: {} },
      { type: 'stop', reason: 'tool_use' },
      { type: 'usage', inputTokens: 5, outputTokens: 5 },
    ];

    const provider = createMockProvider(
      Array(10).fill(infiniteToolCalls) // more than maxRoundTrips
    );

    const events = await collectEvents(baseOptions(provider, { maxRoundTrips: 3 }));

    const roundTrips = events.filter(e => e.type === 'round_trip');
    expect(roundTrips.length).toBeLessThanOrEqual(3);

    const maxReached = events.find(e => e.type === 'max_round_trips_reached');
    expect(maxReached).toBeDefined();
  });

  it('handles tool execution failure with is_error result', async () => {
    const executeTool = vi.fn().mockRejectedValue(new Error('DB error'));

    const provider = createMockProvider([
      [
        { type: 'tool_call', id: 'tc_1', name: 'search', args: {} },
        { type: 'stop', reason: 'tool_use' },
        { type: 'usage', inputTokens: 5, outputTokens: 5 },
      ],
      // Model handles the error
      [
        { type: 'text', delta: 'Sorry, search failed.' },
        { type: 'stop', reason: 'end_turn' },
        { type: 'usage', inputTokens: 20, outputTokens: 10 },
      ],
    ]);

    const events = await collectEvents(baseOptions(provider, { executeTool }));
    const complete = events.find(e => e.type === 'tool_complete') as
      | Extract<ToolLoopEvent, { type: 'tool_complete' }>
      | undefined;

    expect(complete).toBeDefined();
    expect(complete?.result.ok).toBe(false);
    expect(complete?.result.error).toContain('DB error');
  });

  it('stops when signal is aborted', async () => {
    const controller = new AbortController();

    const provider: LLMProvider = {
      id: 'mock',
      displayName: 'Mock',
      async *chat() {
        yield { type: 'text' as const, delta: 'start' };
        controller.abort();
        yield { type: 'text' as const, delta: 'should not appear' };
      },
      async validate() {
        return { ok: true as const };
      },
      async listModels() {
        return [];
      },
    };

    const events = await collectEvents(baseOptions(provider, { signal: controller.signal }));
    const textEvents = events.filter(e => e.type === 'text');
    expect(textEvents.length).toBe(1);
  });
});
