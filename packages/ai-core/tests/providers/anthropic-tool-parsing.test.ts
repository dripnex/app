import { describe, it, expect, vi } from 'vitest';
import { AnthropicProvider } from '../../src/providers/anthropic';
import type { LLMEvent, ChatOptions } from '../../src/types';
import type { ProviderConfig, FetchFn } from '../../src/provider';

function sseChunk(events: Array<{ type: string; [key: string]: unknown }>): string {
  return events.map(e => `event: message\ndata: ${JSON.stringify(e)}\n\n`).join('');
}

function createMockFetch(sseData: string): FetchFn {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    headers: { get: () => null },
    text: () => Promise.resolve(''),
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(sseData));
        controller.close();
      },
    }),
  });
}

const BASE_OPTIONS: ChatOptions = {
  model: 'claude-sonnet-4-20250514',
  system: 'You are helpful.',
  messages: [{ role: 'user', content: 'Search for react notes' }],
  maxTokens: 1024,
  tools: [
    {
      name: 'search_notes',
      description: 'Search notes',
      parameters: { type: 'object', properties: { query: { type: 'string' } } },
    },
  ],
};

const CONFIG: ProviderConfig = { apiKey: 'test-key' };

async function collectEvents(provider: AnthropicProvider): Promise<LLMEvent[]> {
  const events: LLMEvent[] = [];
  for await (const event of provider.chat(BASE_OPTIONS, CONFIG)) {
    events.push(event);
  }
  return events;
}

describe('AnthropicProvider tool use parsing', () => {
  it('parses content_block_start with tool_use and emits tool_call event', async () => {
    const sse = sseChunk([
      {
        type: 'message_start',
        message: { usage: { input_tokens: 50 } },
      },
      {
        type: 'content_block_start',
        index: 0,
        content_block: {
          type: 'tool_use',
          id: 'toolu_123',
          name: 'search_notes',
          input: {},
        },
      },
      {
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'input_json_delta', partial_json: '{"query":' },
      },
      {
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'input_json_delta', partial_json: '"react"}' },
      },
      {
        type: 'content_block_stop',
        index: 0,
      },
      {
        type: 'message_delta',
        delta: { stop_reason: 'tool_use' },
        usage: { output_tokens: 20 },
      },
      { type: 'message_stop' },
    ]);

    const provider = new AnthropicProvider(createMockFetch(sse));
    const events = await collectEvents(provider);

    const toolCall = events.find(e => e.type === 'tool_call');
    expect(toolCall).toBeDefined();
    if (toolCall?.type === 'tool_call') {
      expect(toolCall.id).toBe('toolu_123');
      expect(toolCall.name).toBe('search_notes');
      expect(toolCall.args).toEqual({ query: 'react' });
    }
  });

  it('emits stop event with reason from message_delta', async () => {
    const sse = sseChunk([
      {
        type: 'message_start',
        message: { usage: { input_tokens: 10 } },
      },
      {
        type: 'content_block_start',
        index: 0,
        content_block: { type: 'text', text: '' },
      },
      {
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'text_delta', text: 'Hello' },
      },
      { type: 'content_block_stop', index: 0 },
      {
        type: 'message_delta',
        delta: { stop_reason: 'end_turn' },
        usage: { output_tokens: 5 },
      },
      { type: 'message_stop' },
    ]);

    const provider = new AnthropicProvider(createMockFetch(sse));
    const events = await collectEvents(provider);

    const stop = events.find(e => e.type === 'stop');
    expect(stop).toBeDefined();
    if (stop?.type === 'stop') {
      expect(stop.reason).toBe('end_turn');
    }
  });

  it('handles text + tool_use in same response', async () => {
    const sse = sseChunk([
      {
        type: 'message_start',
        message: { usage: { input_tokens: 30 } },
      },
      {
        type: 'content_block_start',
        index: 0,
        content_block: { type: 'text', text: '' },
      },
      {
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'text_delta', text: 'Let me search.' },
      },
      { type: 'content_block_stop', index: 0 },
      {
        type: 'content_block_start',
        index: 1,
        content_block: {
          type: 'tool_use',
          id: 'toolu_456',
          name: 'search_notes',
          input: {},
        },
      },
      {
        type: 'content_block_delta',
        index: 1,
        delta: { type: 'input_json_delta', partial_json: '{"query":"test"}' },
      },
      { type: 'content_block_stop', index: 1 },
      {
        type: 'message_delta',
        delta: { stop_reason: 'tool_use' },
        usage: { output_tokens: 30 },
      },
      { type: 'message_stop' },
    ]);

    const provider = new AnthropicProvider(createMockFetch(sse));
    const events = await collectEvents(provider);

    const types = events.map(e => e.type);
    expect(types).toContain('text');
    expect(types).toContain('tool_call');
    expect(types).toContain('stop');
    expect(types).toContain('usage');
  });

  it('sends tools in request body as input_schema', async () => {
    const mockFetch = createMockFetch(
      sseChunk([
        { type: 'message_start', message: { usage: { input_tokens: 5 } } },
        {
          type: 'message_delta',
          delta: { stop_reason: 'end_turn' },
          usage: { output_tokens: 1 },
        },
        { type: 'message_stop' },
      ])
    );

    const provider = new AnthropicProvider(mockFetch);
    await collectEvents(provider);

    const call = mockFetch.mock.calls[0]!;
    const body = JSON.parse(call[1].body);
    expect(body.tools).toEqual([
      {
        name: 'search_notes',
        description: 'Search notes',
        input_schema: { type: 'object', properties: { query: { type: 'string' } } },
      },
    ]);
  });
});
