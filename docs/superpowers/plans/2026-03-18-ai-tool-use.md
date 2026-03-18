# AI Tool Use Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable the AI assistant to call tools (search notes, read notes, edit text, create notes) during conversation, with automatic execution for read tools and user confirmation for write tools.

**Architecture:** Extend the existing ai-core provider abstraction with: (1) tool use SSE parsing in AnthropicProvider, (2) a pure-TS tool loop orchestrator, (3) a tool registry, and (4) IPC + UI integration in the Electron app. The tool loop calls the provider directly for multi-turn exchanges, bypassing AIService lifecycle events on subsequent round-trips.

**Tech Stack:** TypeScript, Vitest, Electron IPC, React, Zustand

**Spec:** `docs/superpowers/specs/2026-03-18-ai-tool-use-design.md`

---

## Chunk 1: Core Types & Tool Registry

### Task 1: Extend types.ts with tool-use ContentPart variants and stop event

**Files:**

- Modify: `packages/ai-core/src/types.ts:19-30`
- Test: `packages/ai-core/tests/types.test.ts`

- [ ] **Step 1: Read existing types.test.ts to understand test patterns**

Run: `cat packages/ai-core/tests/types.test.ts`

- [ ] **Step 2: Write failing tests for new types**

Add to `packages/ai-core/tests/types.test.ts`:

```typescript
import type { ContentPart, LLMEvent } from '../src/types';

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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd packages/ai-core && pnpm test -- --reporter verbose 2>&1 | tail -20`
Expected: TypeScript compilation errors — `tool_use` and `tool_result` not assignable to `ContentPart`, `stop` not assignable to `LLMEvent`

- [ ] **Step 4: Extend ContentPart in types.ts**

In `packages/ai-core/src/types.ts`, replace line 30:

```typescript
export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image'; url: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };
```

- [ ] **Step 5: Add stop event to LLMEvent union**

In `packages/ai-core/src/types.ts`, add after the `done` variant (line 26):

```typescript
  | ({ type: 'stop'; reason: 'end_turn' | 'tool_use' | 'max_tokens' } & BaseEvent);
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd packages/ai-core && pnpm test -- --reporter verbose 2>&1 | tail -20`
Expected: All tests pass including the new ones

- [ ] **Step 7: Run typecheck**

Run: `pnpm typecheck 2>&1 | tail -5`
Expected: All tasks successful

- [ ] **Step 8: Commit**

```bash
git add packages/ai-core/src/types.ts packages/ai-core/tests/types.test.ts
git commit -m "feat(ai-core): add tool_use/tool_result ContentPart variants and stop event"
```

---

### Task 2: Create ToolRegistry

**Files:**

- Create: `packages/ai-core/src/tool-registry.ts`
- Create: `packages/ai-core/tests/tool-registry.test.ts`
- Modify: `packages/ai-core/src/index.ts:14` (add export)

- [ ] **Step 1: Write failing tests**

Create `packages/ai-core/tests/tool-registry.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { ToolRegistry } from '../src/tool-registry';
import type { ToolRegistration } from '../src/tool-registry';

function createTool(overrides: Partial<ToolRegistration> = {}): ToolRegistration {
  return {
    name: 'search_notes',
    description: 'Search notes by query',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
    execute: vi.fn().mockResolvedValue({ ok: true, content: '[]' }),
    requiresConfirmation: false,
    ...overrides,
  };
}

describe('ToolRegistry', () => {
  it('registers and retrieves a tool', () => {
    const registry = new ToolRegistry();
    registry.register(createTool());
    expect(registry.get('search_notes')).toBeDefined();
    expect(registry.has('search_notes')).toBe(true);
  });

  it('returns undefined for unknown tool', () => {
    const registry = new ToolRegistry();
    expect(registry.get('unknown')).toBeUndefined();
    expect(registry.has('unknown')).toBe(false);
  });

  it('unregister removes the tool', () => {
    const registry = new ToolRegistry();
    const unregister = registry.register(createTool());
    expect(registry.has('search_notes')).toBe(true);
    unregister();
    expect(registry.has('search_notes')).toBe(false);
  });

  it('getDefinitions returns only name, description, parameters', () => {
    const registry = new ToolRegistry();
    registry.register(createTool());
    registry.register(createTool({ name: 'read_note', description: 'Read a note' }));
    const defs = registry.getDefinitions();
    expect(defs).toHaveLength(2);
    expect(defs[0]).toEqual({
      name: 'search_notes',
      description: 'Search notes by query',
      parameters: expect.any(Object),
    });
    // Should NOT contain execute or requiresConfirmation
    expect(defs[0]).not.toHaveProperty('execute');
    expect(defs[0]).not.toHaveProperty('requiresConfirmation');
  });

  it('throws on duplicate registration', () => {
    const registry = new ToolRegistry();
    registry.register(createTool());
    expect(() => registry.register(createTool())).toThrow('already registered');
  });

  it('allows re-registration after unregister', () => {
    const registry = new ToolRegistry();
    const unregister = registry.register(createTool());
    unregister();
    expect(() => registry.register(createTool())).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/ai-core && pnpm test -- tool-registry --reporter verbose 2>&1 | tail -10`
Expected: FAIL — cannot find `../src/tool-registry`

- [ ] **Step 3: Implement ToolRegistry**

Create `packages/ai-core/src/tool-registry.ts`:

```typescript
// packages/ai-core/src/tool-registry.ts
import type { ToolDefinition } from './types.js';

export interface ToolResult {
  ok: boolean;
  content: string;
  error?: string;
}

export interface ToolRegistration extends ToolDefinition {
  execute: (args: Record<string, unknown>) => Promise<ToolResult>;
  requiresConfirmation: boolean;
}

export class ToolRegistry {
  private tools = new Map<string, ToolRegistration>();

  register(tool: ToolRegistration): () => void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" is already registered`);
    }
    this.tools.set(tool.name, tool);
    return () => {
      this.tools.delete(tool.name);
    };
  }

  get(name: string): ToolRegistration | undefined {
    return this.tools.get(name);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  getDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map(({ name, description, parameters }) => ({
      name,
      description,
      parameters,
    }));
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/ai-core && pnpm test -- tool-registry --reporter verbose 2>&1 | tail -10`
Expected: All 6 tests pass

- [ ] **Step 5: Export from index.ts**

Add to `packages/ai-core/src/index.ts` after the ProviderRegistry export (line 14):

```typescript
export { ToolRegistry } from './tool-registry.js';
export type { ToolRegistration, ToolResult } from './tool-registry.js';
```

- [ ] **Step 6: Run typecheck**

Run: `pnpm typecheck 2>&1 | tail -5`
Expected: All tasks successful

- [ ] **Step 7: Commit**

```bash
git add packages/ai-core/src/tool-registry.ts packages/ai-core/tests/tool-registry.test.ts packages/ai-core/src/index.ts
git commit -m "feat(ai-core): add ToolRegistry with register/unregister/getDefinitions"
```

---

## Chunk 2: Anthropic Provider Tool Use Parsing

### Task 3: Parse tool_use SSE events and emit stop reason in AnthropicProvider

**Files:**

- Modify: `packages/ai-core/src/providers/anthropic.ts:48-56,130-174`
- Create: `packages/ai-core/tests/providers/anthropic-tool-parsing.test.ts`

- [ ] **Step 1: Write failing test for tool_use content block parsing**

Create `packages/ai-core/tests/providers/anthropic-tool-parsing.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/ai-core && pnpm test -- anthropic-tool --reporter verbose 2>&1 | tail -15`
Expected: FAIL — tool_call event not found, stop event not found

- [ ] **Step 3: Extend normalizeContent to handle tool_use/tool_result ContentParts**

In `packages/ai-core/src/providers/anthropic.ts`, replace `normalizeContent` (lines 48-56):

```typescript
function normalizeContent(content: MessageContent): string | Array<Record<string, unknown>> {
  if (typeof content === 'string') return content;
  return content.map(part => {
    switch (part.type) {
      case 'text':
        return { type: 'text', text: part.text };
      case 'tool_use':
        return { type: 'tool_use', id: part.id, name: part.name, input: part.input };
      case 'tool_result':
        return {
          type: 'tool_result',
          tool_use_id: part.tool_use_id,
          content: part.content,
          ...(part.is_error ? { is_error: true } : {}),
        };
      case 'image':
        return { type: 'text', text: '[image]' };
      default:
        return { type: 'text', text: '' };
    }
  });
}
```

- [ ] **Step 4: Add tool_use parsing to the SSE switch statement**

In `packages/ai-core/src/providers/anthropic.ts`, replace the switch block inside `for await (const sseEvent of parseSSEStream(...))` (lines 136-173). Add tracking state before the loop (after `let inputTokens = 0;`):

```typescript
// Tool use accumulation state
const toolBlocks = new Map<number, { id: string; name: string; jsonBuf: string }>();
```

Add these cases to the switch statement:

```typescript
        case 'content_block_start': {
          const block = data.content_block as Record<string, unknown>;
          const index = data.index as number;
          if (block.type === 'tool_use') {
            toolBlocks.set(index, {
              id: block.id as string,
              name: block.name as string,
              jsonBuf: '',
            });
          }
          break;
        }

        case 'content_block_delta': {
          const delta = data.delta as Record<string, unknown>;
          const index = data.index as number;
          if (delta.type === 'text_delta') {
            yield { type: 'text', delta: delta.text as string };
          } else if (delta.type === 'input_json_delta') {
            const block = toolBlocks.get(index);
            if (block) {
              block.jsonBuf += delta.partial_json as string;
            }
          }
          break;
        }

        case 'content_block_stop': {
          const index = data.index as number;
          const block = toolBlocks.get(index);
          if (block) {
            let args: Record<string, unknown> = {};
            try {
              args = JSON.parse(block.jsonBuf || '{}');
            } catch {
              // Malformed JSON — use empty args
            }
            yield { type: 'tool_call', id: block.id, name: block.name, args };
            toolBlocks.delete(index);
          }
          break;
        }
```

Update the existing `content_block_delta` case — it must be **removed** since the new one above handles both `text_delta` and `input_json_delta`. Also update `message_delta` to emit `stop`:

```typescript
        case 'message_delta': {
          const delta = data.delta as Record<string, unknown>;
          const usage = data.usage as { output_tokens: number } | undefined;
          if (usage) {
            yield { type: 'usage', inputTokens, outputTokens: usage.output_tokens };
          }
          if (delta.stop_reason) {
            yield {
              type: 'stop',
              reason: delta.stop_reason as 'end_turn' | 'tool_use' | 'max_tokens',
            };
          }
          break;
        }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd packages/ai-core && pnpm test -- anthropic-tool --reporter verbose 2>&1 | tail -15`
Expected: All 4 tests pass

- [ ] **Step 6: Run all ai-core tests to check for regressions**

Run: `cd packages/ai-core && pnpm test -- --reporter verbose 2>&1 | tail -20`
Expected: All tests pass

- [ ] **Step 7: Run typecheck**

Run: `pnpm typecheck 2>&1 | tail -5`
Expected: All tasks successful

- [ ] **Step 8: Commit**

```bash
git add packages/ai-core/src/providers/anthropic.ts packages/ai-core/tests/providers/anthropic-tool-parsing.test.ts
git commit -m "feat(ai-core): parse tool_use SSE events and emit stop reason in AnthropicProvider"
```

---

## Chunk 3: Tool Loop Orchestrator

### Task 4: Implement runToolLoop async generator

**Files:**

- Create: `packages/ai-core/src/tool-loop.ts`
- Create: `packages/ai-core/tests/tool-loop.test.ts`
- Modify: `packages/ai-core/src/index.ts` (add export)

- [ ] **Step 1: Write failing tests**

Create `packages/ai-core/tests/tool-loop.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/ai-core && pnpm test -- tool-loop --reporter verbose 2>&1 | tail -10`
Expected: FAIL — cannot find `../src/tool-loop`

- [ ] **Step 3: Implement runToolLoop**

Create `packages/ai-core/src/tool-loop.ts`:

```typescript
// packages/ai-core/src/tool-loop.ts
import type { LLMEvent, ChatOptions, ChatMessage, ContentPart } from './types.js';
import type { LLMProvider, ProviderConfig } from './provider.js';
import type { ToolResult } from './tool-registry.js';

// ─── Types ──────────────────────────────────────────────────

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export type ToolLoopEvent =
  | LLMEvent
  | { type: 'tool_executing'; call: ToolCall }
  | { type: 'tool_complete'; call: ToolCall; result: ToolResult }
  | { type: 'round_trip'; current: number; max: number }
  | { type: 'max_round_trips_reached' };

export interface ToolLoopOptions {
  provider: LLMProvider;
  providerConfig: ProviderConfig;
  chatOptions: ChatOptions;
  maxRoundTrips: number;
  signal: AbortSignal;
  executeTool: (call: ToolCall) => Promise<ToolResult>;
}

// ─── Implementation ─────────────────────────────────────────

export async function* runToolLoop(options: ToolLoopOptions): AsyncIterable<ToolLoopEvent> {
  const { provider, providerConfig, chatOptions, maxRoundTrips, signal, executeTool } = options;

  // Mutable copy of messages for multi-turn
  const messages: ChatMessage[] = [...chatOptions.messages];
  let roundTrip = 0;

  while (roundTrip < maxRoundTrips) {
    if (signal.aborted) return;

    const currentOptions: ChatOptions = {
      ...chatOptions,
      messages: [...messages],
      signal,
    };

    // Collect events from this provider call
    const pendingToolCalls: ToolCall[] = [];
    let stopReason: string | null = null;
    const textParts: string[] = [];

    for await (const event of provider.chat(currentOptions, providerConfig)) {
      if (signal.aborted) return;

      // Collect tool calls
      if (event.type === 'tool_call') {
        pendingToolCalls.push({
          id: event.id,
          name: event.name,
          args: event.args as Record<string, unknown>,
        });
      }

      // Track stop reason
      if (event.type === 'stop') {
        stopReason = event.reason;
      }

      // Track text for history
      if (event.type === 'text') {
        textParts.push(event.delta);
      }

      // Pass through all provider events
      yield event;
    }

    // If no tool calls or stop reason is not tool_use, we're done
    if (pendingToolCalls.length === 0 || stopReason !== 'tool_use') {
      return;
    }

    // Build the assistant message with text + tool_use content blocks
    const assistantContent: ContentPart[] = [];
    const fullText = textParts.join('');
    if (fullText) {
      assistantContent.push({ type: 'text', text: fullText });
    }
    for (const call of pendingToolCalls) {
      assistantContent.push({
        type: 'tool_use',
        id: call.id,
        name: call.name,
        input: call.args,
      });
    }
    messages.push({ role: 'assistant', content: assistantContent });

    // Execute tools and collect results
    const toolResultParts: ContentPart[] = [];
    for (const call of pendingToolCalls) {
      if (signal.aborted) return;

      yield { type: 'tool_executing', call };

      let result: ToolResult;
      try {
        result = await executeTool(call);
      } catch (err) {
        result = {
          ok: false,
          content: err instanceof Error ? err.message : String(err),
          error: err instanceof Error ? err.message : String(err),
        };
      }

      yield { type: 'tool_complete', call, result };

      toolResultParts.push({
        type: 'tool_result',
        tool_use_id: call.id,
        content: result.content,
        ...(result.ok ? {} : { is_error: true }),
      });
    }

    // Append tool results as a user message
    messages.push({ role: 'user', content: toolResultParts });

    roundTrip++;
    yield { type: 'round_trip', current: roundTrip, max: maxRoundTrips };
  }

  // Exceeded max round trips
  yield { type: 'max_round_trips_reached' };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/ai-core && pnpm test -- tool-loop --reporter verbose 2>&1 | tail -15`
Expected: All 5 tests pass

- [ ] **Step 5: Export from index.ts**

Add to `packages/ai-core/src/index.ts`:

```typescript
export { runToolLoop } from './tool-loop.js';
export type { ToolCall, ToolLoopEvent, ToolLoopOptions } from './tool-loop.js';
```

- [ ] **Step 6: Run typecheck**

Run: `pnpm typecheck 2>&1 | tail -5`
Expected: All tasks successful

- [ ] **Step 7: Commit**

```bash
git add packages/ai-core/src/tool-loop.ts packages/ai-core/tests/tool-loop.test.ts packages/ai-core/src/index.ts
git commit -m "feat(ai-core): implement runToolLoop orchestrator for multi-turn tool use"
```

---

## Chunk 4: AIService chatWithTools & IPC Integration

### Task 5: Add chatWithTools to AIService

**Files:**

- Modify: `packages/ai-core/src/ai-service.ts:11-32,38-58`
- Modify: `packages/ai-core/src/index.ts` (export new types)

- [ ] **Step 1: Write failing test**

Add to `packages/ai-core/tests/ai-service.test.ts`:

```typescript
describe('AIServiceImpl.chatWithTools', () => {
  it('returns ChatHandle with requestId and events', () => {
    const registry = new ProviderRegistry();
    registry.register(
      createMockProvider([
        { type: 'text', delta: 'hi' },
        { type: 'stop', reason: 'end_turn' } as LLMEvent,
      ])
    );
    const service = new AIServiceImpl(registry);

    const handle = service.chatWithTools({
      ...createRequest(),
      tools: [{ name: 'test', description: 'Test', parameters: {} }],
      executeTool: async () => ({ ok: true, content: 'ok' }),
    });

    expect(handle.requestId).toBeTruthy();
    expect(typeof handle.abort).toBe('function');
  });

  it('emits start and done wrapping the tool loop', async () => {
    const registry = new ProviderRegistry();
    registry.register(
      createMockProvider([
        { type: 'text', delta: 'hi' },
        { type: 'stop', reason: 'end_turn' } as LLMEvent,
        { type: 'usage', inputTokens: 10, outputTokens: 5 },
      ])
    );
    const service = new AIServiceImpl(registry);

    const events = await collectEvents(
      service.chatWithTools({
        ...createRequest(),
        tools: [{ name: 'test', description: 'Test', parameters: {} }],
        executeTool: async () => ({ ok: true, content: 'ok' }),
      })
    );

    expect(events[0]?.type).toBe('start');
    expect(events[events.length - 1]?.type).toBe('done');
  });
});
```

Note: you will need to import `ToolLoopEvent` type and update the `collectEvents` helper to accept `ToolLoopEvent` too. Update the import at the top of the test file:

```typescript
import type { ToolLoopEvent, ToolChatRequest } from '../src/ai-service';
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/ai-core && pnpm test -- ai-service --reporter verbose 2>&1 | tail -10`
Expected: FAIL — `chatWithTools` does not exist

- [ ] **Step 3: Implement chatWithTools**

In `packages/ai-core/src/ai-service.ts`:

Add imports at top:

```typescript
import type { ToolDefinition } from './types.js';
import type { ToolResult } from './tool-registry.js';
import type { ToolCall, ToolLoopEvent } from './tool-loop.js';
import { runToolLoop } from './tool-loop.js';
```

Add `ToolChatRequest` interface after `ChatRequest`:

```typescript
export interface ToolChatRequest extends ChatRequest {
  tools: ToolDefinition[];
  maxRoundTrips?: number;
  executeTool: (call: ToolCall) => Promise<ToolResult>;
}
```

Create a separate `ToolChatHandle` for tool use (keeps existing `ChatHandle` unchanged):

```typescript
export interface ToolChatHandle {
  requestId: string;
  events: AsyncIterable<LLMEvent | ToolLoopEvent>;
  abort: () => void;
}

export interface AIService {
  chat(request: ChatRequest): ChatHandle;
  chatWithTools(request: ToolChatRequest): ToolChatHandle;
  cancelAll(): void;
}
```

Add `chatWithTools` method to `AIServiceImpl`:

```typescript
  chatWithTools(request: ToolChatRequest): ToolChatHandle {
    const requestId = crypto.randomUUID();
    const controller = new AbortController();
    this.activeRequests.set(requestId, controller);

    const events = this.executeChatWithTools(requestId, request, controller.signal);

    return {
      requestId,
      events,
      abort: () => {
        controller.abort();
        this.activeRequests.delete(requestId);
      },
    };
  }

  private async *executeChatWithTools(
    requestId: string,
    request: ToolChatRequest,
    signal: AbortSignal
  ): AsyncIterable<LLMEvent | ToolLoopEvent> {
    const startTime = Date.now();
    const provider = this.registry.get(request.provider);
    const maxResponseTokens = request.maxResponseTokens ?? DEFAULT_MAX_RESPONSE_TOKENS;

    const models = await provider.listModels(request.providerConfig);
    const modelInfo = models.find(m => m.id === request.model);
    const contextWindow = modelInfo?.contextWindow ?? 200_000;

    const systemPrompt = request.mode === 'ask-notes' ? ASK_NOTES_SYSTEM_PROMPT : SYSTEM_PROMPT;
    const context = buildContext(
      {
        systemPrompt,
        currentNote: request.currentNote,
        history: request.history,
        relevantNotes: request.relevantNotes,
      },
      { maxContextTokens: contextWindow, maxResponseTokens }
    );

    const messages: ChatMessage[] = [...context.messages, { role: 'user', content: request.query }];

    // Emit start (AIService owns this)
    yield {
      type: 'start',
      model: request.model,
      requestId,
      provider: provider.id,
    };

    try {
      const toolLoop = runToolLoop({
        provider,
        providerConfig: request.providerConfig,
        chatOptions: {
          model: request.model,
          system: context.system,
          messages,
          maxTokens: maxResponseTokens,
          signal,
          tools: request.tools,
        },
        maxRoundTrips: request.maxRoundTrips ?? 5,
        signal,
        executeTool: request.executeTool,
      });

      for await (const event of toolLoop) {
        if (signal.aborted) break;
        yield event;
      }
    } catch (err) {
      if (!signal.aborted) {
        yield {
          type: 'error',
          code: 'provider_error' as const,
          error: err instanceof Error ? err.message : String(err),
          retryable: false,
        };
      }
    } finally {
      this.activeRequests.delete(requestId);
      yield {
        type: 'done',
        durationMs: Date.now() - startTime,
        cancelled: signal.aborted ? true : undefined,
      };
    }
  }
```

- [ ] **Step 4: Export new types from index.ts**

Add to `packages/ai-core/src/index.ts`:

```typescript
export type { ToolChatRequest } from './ai-service.js';
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd packages/ai-core && pnpm test -- --reporter verbose 2>&1 | tail -20`
Expected: All tests pass

- [ ] **Step 6: Run typecheck**

Run: `pnpm typecheck 2>&1 | tail -5`
Expected: All tasks successful

- [ ] **Step 7: Commit**

```bash
git add packages/ai-core/src/ai-service.ts packages/ai-core/src/index.ts packages/ai-core/tests/ai-service.test.ts
git commit -m "feat(ai-core): add chatWithTools method to AIService with tool loop integration"
```

---

### Task 6: Extend IPC bridge with tool loop support

**Files:**

- Modify: `apps/desktop/src/main/ai/ipc-ai.ts`
- Modify: `apps/desktop/src/main/ai/setup.ts`
- Modify: `apps/desktop/src/preload/index.ts:1036-1050`

- [ ] **Step 1: Update setup.ts to expose ToolRegistry**

Replace `apps/desktop/src/main/ai/setup.ts`:

```typescript
// apps/desktop/src/main/ai/setup.ts
import { net } from 'electron';
import { ProviderRegistry, AnthropicProvider, AIServiceImpl, ToolRegistry } from '@readied/ai-core';
import type { AIService, FetchFn } from '@readied/ai-core';

let service: AIService | null = null;
let toolRegistryInstance: ToolRegistry | null = null;

export function createAIService(): AIService {
  if (service) return service;

  const registry = new ProviderRegistry();
  registry.register(new AnthropicProvider(net.fetch as unknown as FetchFn));

  service = new AIServiceImpl(registry);
  return service;
}

export function getToolRegistry(): ToolRegistry {
  if (!toolRegistryInstance) {
    toolRegistryInstance = new ToolRegistry();
  }
  return toolRegistryInstance;
}
```

- [ ] **Step 2: Update ipc-ai.ts to support tools in ai:chat and add ai:tool-confirm**

In `apps/desktop/src/main/ai/ipc-ai.ts`:

Add imports:

```typescript
import type { ToolCall, ToolResult } from '@readied/ai-core';
import { ToolRegistry } from '@readied/ai-core';
```

Update `registerAIHandlers` signature:

```typescript
export function registerAIHandlers(service: AIService, toolRegistry: ToolRegistry): void {
```

Add pending confirmation tracking after `activeHandles`:

```typescript
// Pending tool confirmations: requestId -> callId -> resolve function
const pendingConfirmations = new Map<string, Map<string, (approved: boolean) => void>>();
const CONFIRM_TIMEOUT_MS = 60_000;
```

Update the `ai:chat` handler to check for tools. Replace the handler body (lines 15-43):

```typescript
ipcMain.handle(
  'ai:chat',
  (
    event,
    request: {
      query: string;
      currentNote?: { id: string; title: string; content: string } | null;
      relevantNotes: Array<{ id: string; title: string; content: string }>;
      history: Array<{ role: 'user' | 'assistant'; content: string }>;
      mode: 'chat' | 'ask-notes';
      provider: string;
      model: string;
      providerConfig: { apiKey?: string; baseUrl?: string };
      maxResponseTokens?: number;
      tools?: boolean; // true = include tools from registry
    }
  ) => {
    const windowId = event.sender.id;
    const toolDefs = request.tools ? toolRegistry.getDefinitions() : [];

    // Build executeTool callback that closes over requestId (set after handle creation)
    let requestId = '';
    const executeTool = async (call: ToolCall) => {
      const tool = toolRegistry.get(call.name);
      if (!tool) {
        return {
          ok: false,
          content: `Unknown tool: ${call.name}`,
          error: `Unknown tool: ${call.name}`,
        };
      }

      if (tool.requiresConfirmation) {
        // Notify renderer that this tool needs user confirmation
        event.sender.send('ai:event', requestId, { type: 'tool_confirm_needed', callId: call.id });
        const approved = await waitForConfirmation(requestId, call.id, event.sender);
        if (!approved) {
          return { ok: false, content: 'Tool execution cancelled by user', error: 'Cancelled' };
        }
      }

      return tool.execute(call.args);
    };

    const handle =
      toolDefs.length > 0
        ? service.chatWithTools({ ...request, tools: toolDefs, executeTool })
        : service.chat(request);

    requestId = handle.requestId;

    // Track handle
    if (!activeHandles.has(windowId)) {
      activeHandles.set(windowId, new Map());
    }
    activeHandles.get(windowId)!.set(handle.requestId, handle);

    consumeStream(event.sender, handle);

    return { requestId: handle.requestId };
  }
);
```

Add the `waitForConfirmation` helper and `ai:tool-confirm` handler:

```typescript
function waitForConfirmation(
  requestId: string,
  callId: string,
  sender: Electron.WebContents
): Promise<boolean> {
  return new Promise<boolean>(resolve => {
    if (!pendingConfirmations.has(requestId)) {
      pendingConfirmations.set(requestId, new Map());
    }
    pendingConfirmations.get(requestId)!.set(callId, resolve);

    // Timeout auto-rejects
    setTimeout(() => {
      const pending = pendingConfirmations.get(requestId)?.get(callId);
      if (pending) {
        pendingConfirmations.get(requestId)!.delete(callId);
        resolve(false);
      }
    }, CONFIRM_TIMEOUT_MS);
  });
}

ipcMain.handle(
  'ai:tool-confirm',
  (_event, requestId: string, callId: string, approved: boolean) => {
    const resolve = pendingConfirmations.get(requestId)?.get(callId);
    if (resolve) {
      resolve(approved);
      pendingConfirmations.get(requestId)!.delete(callId);
    }
  }
);
```

- [ ] **Step 3: Update preload to add confirmTool method**

In `apps/desktop/src/preload/index.ts`, add after `importPreset` (line 1049):

```typescript
    confirmTool: (requestId: string, callId: string, approved: boolean) =>
      ipcRenderer.invoke('ai:tool-confirm', requestId, callId, approved),
```

- [ ] **Step 4: Update the caller of registerAIHandlers to pass toolRegistry**

Find where `registerAIHandlers` is called and update it to pass the tool registry. Search for the import:

Run: `grep -rn 'registerAIHandlers' apps/desktop/src/main/`

Update the call site to:

```typescript
import { createAIService, getToolRegistry } from './ai/setup';
// ...
registerAIHandlers(createAIService(), getToolRegistry());
```

- [ ] **Step 5: Run typecheck**

Run: `pnpm typecheck 2>&1 | tail -10`
Expected: All tasks successful

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/main/ai/ipc-ai.ts apps/desktop/src/main/ai/setup.ts apps/desktop/src/preload/index.ts apps/desktop/src/main/
git commit -m "feat(desktop): extend IPC bridge with tool loop support and confirmation flow"
```

---

## Chunk 5: Built-in Tools & UI

### Task 7: Register built-in tools

**Files:**

- Create: `apps/desktop/src/main/ai/built-in-tools.ts`
- Modify: `apps/desktop/src/main/ai/setup.ts` (call registration)

- [ ] **Step 1: Identify available database query functions**

Run: `grep -rn 'export.*function.*search\|export.*function.*getNote\|export.*function.*listNotebook\|export.*function.*createNote' apps/desktop/src/main/ --include='*.ts' | head -20`

This will reveal the exact functions available for note operations. Adapt the tool implementations to call these functions.

- [ ] **Step 2: Create built-in-tools.ts**

Create `apps/desktop/src/main/ai/built-in-tools.ts`:

```typescript
// apps/desktop/src/main/ai/built-in-tools.ts
import type { ToolRegistry } from '@readied/ai-core';

/**
 * Register built-in AI tools for note operations.
 *
 * Read tools (auto-execute): search_notes, read_note, list_notebooks
 * Write tools (require confirmation): create_note
 *
 * Note: insert_text and replace_selection are handled in the renderer
 * since they need editor access. They will be added in the UI task.
 */
export function registerBuiltInTools(
  registry: ToolRegistry,
  deps: {
    searchNotes: (
      query: string,
      limit?: number
    ) => Promise<Array<{ id: string; title: string; snippet: string }>>;
    readNote: (id: string) => Promise<{ id: string; title: string; content: string } | null>;
    listNotebooks: () => Promise<Array<{ id: string; name: string; noteCount: number }>>;
    createNote: (title: string, content: string, notebookId?: string) => Promise<{ id: string }>;
  }
): void {
  registry.register({
    name: 'search_notes',
    description: 'Search notes by keyword query. Returns matching note IDs, titles, and snippets.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        limit: { type: 'number', description: 'Max results (default 10)' },
      },
      required: ['query'],
    },
    requiresConfirmation: false,
    execute: async args => {
      const results = await deps.searchNotes(args.query as string, (args.limit as number) ?? 10);
      return { ok: true, content: JSON.stringify(results) };
    },
  });

  registry.register({
    name: 'read_note',
    description: 'Read the full content of a note by its ID.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Note ID' },
      },
      required: ['id'],
    },
    requiresConfirmation: false,
    execute: async args => {
      const note = await deps.readNote(args.id as string);
      if (!note) return { ok: false, content: 'Note not found', error: 'Note not found' };
      return { ok: true, content: JSON.stringify(note) };
    },
  });

  registry.register({
    name: 'list_notebooks',
    description: 'List all notebooks with their names and note counts.',
    parameters: {
      type: 'object',
      properties: {},
    },
    requiresConfirmation: false,
    execute: async () => {
      const notebooks = await deps.listNotebooks();
      return { ok: true, content: JSON.stringify(notebooks) };
    },
  });

  registry.register({
    name: 'create_note',
    description: 'Create a new note in a notebook.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Note title' },
        content: { type: 'string', description: 'Note content in markdown' },
        notebookId: { type: 'string', description: 'Target notebook ID (optional, uses default)' },
      },
      required: ['title', 'content'],
    },
    requiresConfirmation: true,
    execute: async args => {
      const result = await deps.createNote(
        args.title as string,
        args.content as string,
        args.notebookId as string | undefined
      );
      return { ok: true, content: JSON.stringify(result) };
    },
  });
}
```

- [ ] **Step 3: Wire built-in tools in setup.ts**

This depends on the available database functions found in Step 1. Update `setup.ts` to call `registerBuiltInTools(getToolRegistry(), { ... })` with the actual database query functions. This wiring is app-specific and will need adaptation based on what Step 1 reveals.

- [ ] **Step 4: Run typecheck**

Run: `pnpm typecheck 2>&1 | tail -5`
Expected: All tasks successful

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/main/ai/built-in-tools.ts apps/desktop/src/main/ai/setup.ts
git commit -m "feat(desktop): register built-in AI tools (search, read, list, create)"
```

---

### Task 8: Create ToolCallBlock component

**Files:**

- Create: `apps/desktop/src/renderer/components/ai/ToolCallBlock.tsx`

- [ ] **Step 1: Create ToolCallBlock component**

Create `apps/desktop/src/renderer/components/ai/ToolCallBlock.tsx`:

```typescript
import { useState } from 'react';
import { Search, FileText, FolderOpen, PenLine, Replace, FilePlus, Loader2, CheckCircle, XCircle, ChevronDown, ChevronRight } from 'lucide-react';

type ToolCallStatus = 'pending_confirmation' | 'executing' | 'complete' | 'rejected' | 'error';

interface ToolCallBlockProps {
  name: string;
  args: Record<string, unknown>;
  status: ToolCallStatus;
  result?: { ok: boolean; content: string; error?: string };
  onConfirm?: () => void;
  onReject?: () => void;
}

const TOOL_ICONS: Record<string, typeof Search> = {
  search_notes: Search,
  read_note: FileText,
  list_notebooks: FolderOpen,
  insert_text: PenLine,
  replace_selection: Replace,
  create_note: FilePlus,
};

export function ToolCallBlock({ name, args, status, result, onConfirm, onReject }: ToolCallBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const Icon = TOOL_ICONS[name] ?? Search;

  return (
    <div className="ai-tool-call">
      <div className="ai-tool-call-header" onClick={() => setExpanded(prev => !prev)}>
        <div className="ai-tool-call-left">
          {status === 'executing' ? (
            <Loader2 size={14} className="ai-tool-call-spinning" />
          ) : status === 'complete' && result?.ok ? (
            <CheckCircle size={14} className="ai-tool-call-success" />
          ) : status === 'error' || (status === 'complete' && !result?.ok) ? (
            <XCircle size={14} className="ai-tool-call-error" />
          ) : (
            <Icon size={14} />
          )}
          <span className="ai-tool-call-name">{name}</span>
          <span className="ai-tool-call-status">
            {status === 'pending_confirmation' && '— needs approval'}
            {status === 'executing' && '— running...'}
            {status === 'rejected' && '— cancelled'}
          </span>
        </div>
        <div className="ai-tool-call-right">
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </div>
      </div>

      {status === 'pending_confirmation' && (
        <div className="ai-tool-call-actions">
          <button className="ai-tool-call-btn approve" onClick={onConfirm}>
            Run
          </button>
          <button className="ai-tool-call-btn reject" onClick={onReject}>
            Cancel
          </button>
        </div>
      )}

      {expanded && (
        <div className="ai-tool-call-details">
          {Object.keys(args).length > 0 && (
            <div className="ai-tool-call-args">
              <div className="ai-tool-call-label">Args</div>
              <pre>{JSON.stringify(args, null, 2)}</pre>
            </div>
          )}
          {result && (
            <div className="ai-tool-call-result">
              <div className="ai-tool-call-label">Result</div>
              <pre>{result.content.slice(0, 500)}{result.content.length > 500 ? '...' : ''}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm typecheck 2>&1 | tail -5`
Expected: All tasks successful

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/renderer/components/ai/ToolCallBlock.tsx
git commit -m "feat(desktop): add ToolCallBlock component for tool call rendering"
```

---

### Task 9: Integrate tool events into AiPanel

**Files:**

- Modify: `apps/desktop/src/renderer/components/ai/AiPanel.tsx:66-132`
- Modify: `apps/desktop/src/renderer/styles/ai-panel.css`

- [ ] **Step 1: Add tool call state and event handling to AiPanel**

In `AiPanel.tsx`, add new state variables after `activeRequestRef`:

```typescript
// Tool call tracking
const [toolCalls, setToolCalls] = useState<
  Map<
    string,
    {
      name: string;
      args: Record<string, unknown>;
      status: 'pending_confirmation' | 'executing' | 'complete' | 'rejected' | 'error';
      result?: { ok: boolean; content: string; error?: string };
    }
  >
>(new Map());
```

In the `onEvent` handler (the `useEffect` with `window.readied.ai.onEvent`), add cases for tool events inside the switch:

```typescript
        case 'tool_call':
          // Provider-emitted tool_call — register it as 'pending'
          // (will transition to 'executing' or 'pending_confirmation'
          //  when tool_executing arrives, or stay if confirmation needed)
          setToolCalls(prev => {
            const next = new Map(prev);
            next.set(event.id, {
              name: event.name,
              args: event.args as Record<string, unknown>,
              status: 'executing', // default: assume auto-execute
            });
            return next;
          });
          break;

        case 'tool_confirm_needed':
          // Custom event from IPC: this tool needs user confirmation
          // (emitted by main process for requiresConfirmation tools)
          setToolCalls(prev => {
            const next = new Map(prev);
            const e = event as { callId: string };
            const existing = next.get(e.callId);
            if (existing) {
              next.set(e.callId, { ...existing, status: 'pending_confirmation' });
            }
            return next;
          });
          break;

        case 'tool_executing':
          setToolCalls(prev => {
            const next = new Map(prev);
            const call = event.call as { id: string; name: string; args: Record<string, unknown> };
            const existing = next.get(call.id);
            if (existing) {
              next.set(call.id, { ...existing, status: 'executing' });
            } else {
              next.set(call.id, { name: call.name, args: call.args, status: 'executing' });
            }
            return next;
          });
          break;

        case 'tool_complete':
          setToolCalls(prev => {
            const next = new Map(prev);
            const tc = event as { call: { id: string }; result: { ok: boolean; content: string; error?: string } };
            const existing = next.get(tc.call.id);
            if (existing) {
              next.set(tc.call.id, { ...existing, status: 'complete', result: tc.result });
            }
            return next;
          });
          break;
```

Update the `handleSubmit` to pass `tools: true` in the chat request (in the `window.readied.ai.chat()` call):

```typescript
const { requestId } = await window.readied.ai.chat({
  // ...existing fields...
  tools: true,
});
```

Add confirm/reject handlers:

```typescript
const handleToolConfirm = useCallback((callId: string) => {
  if (activeRequestRef.current) {
    window.readied.ai.confirmTool(activeRequestRef.current, callId, true);
  }
}, []);

const handleToolReject = useCallback((callId: string) => {
  if (activeRequestRef.current) {
    window.readied.ai.confirmTool(activeRequestRef.current, callId, false);
    setToolCalls(prev => {
      const next = new Map(prev);
      const existing = next.get(callId);
      if (existing) next.set(callId, { ...existing, status: 'rejected' });
      return next;
    });
  }
}, []);
```

Clear tool calls when clearing conversation (`handleClear`):

```typescript
const handleClear = useCallback(() => {
  setMessages([]);
  setError(null);
  setContextCount(0);
  setToolCalls(new Map());
}, []);
```

- [ ] **Step 2: Render ToolCallBlock in the messages area**

In the JSX, after the messages map and before the loading indicator, render tool calls:

```tsx
{
  Array.from(toolCalls.entries()).map(([callId, tc]) => (
    <ToolCallBlock
      key={callId}
      name={tc.name}
      args={tc.args}
      status={tc.status}
      result={tc.result}
      onConfirm={() => handleToolConfirm(callId)}
      onReject={() => handleToolReject(callId)}
    />
  ));
}
```

Import `ToolCallBlock`:

```typescript
import { ToolCallBlock } from './ToolCallBlock';
```

- [ ] **Step 3: Add CSS styles for tool call blocks**

Append to `apps/desktop/src/renderer/styles/ai-panel.css`:

```css
/* Tool Call Block */
.ai-tool-call {
  margin: 0.5rem 1rem;
  border: 1px solid var(--border-strong);
  border-radius: 0.5rem;
  overflow: hidden;
  font-size: 0.8125rem;
}

.ai-tool-call-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0.75rem;
  background: var(--bg-hover);
  cursor: pointer;
  user-select: none;
}

.ai-tool-call-left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.ai-tool-call-name {
  font-weight: 500;
  color: var(--text-primary);
}

.ai-tool-call-status {
  color: var(--text-tertiary);
  font-size: 0.75rem;
}

.ai-tool-call-spinning {
  animation: ai-spin 1s linear infinite;
}

@keyframes ai-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.ai-tool-call-success {
  color: var(--success, #22c55e);
}

.ai-tool-call-error {
  color: var(--error, #ef4444);
}

.ai-tool-call-actions {
  display: flex;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-top: 1px solid var(--border-strong);
}

.ai-tool-call-btn {
  padding: 0.25rem 0.75rem;
  border-radius: 0.375rem;
  border: 1px solid var(--border-strong);
  background: var(--bg-tertiary);
  color: var(--text-primary);
  font-size: 0.75rem;
  cursor: pointer;
}

.ai-tool-call-btn.approve {
  background: var(--accent, #5eead4);
  color: var(--bg-primary, #000);
  border-color: transparent;
}

.ai-tool-call-details {
  padding: 0.5rem 0.75rem;
  border-top: 1px solid var(--border-strong);
}

.ai-tool-call-label {
  font-size: 0.6875rem;
  text-transform: uppercase;
  color: var(--text-tertiary);
  margin-bottom: 0.25rem;
}

.ai-tool-call-details pre {
  margin: 0;
  font-size: 0.75rem;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--text-secondary);
}

.ai-tool-call-args + .ai-tool-call-result {
  margin-top: 0.5rem;
}
```

- [ ] **Step 4: Run typecheck**

Run: `pnpm typecheck 2>&1 | tail -5`
Expected: All tasks successful

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/renderer/components/ai/AiPanel.tsx apps/desktop/src/renderer/components/ai/ToolCallBlock.tsx apps/desktop/src/renderer/styles/ai-panel.css
git commit -m "feat(desktop): integrate tool use events and ToolCallBlock into AiPanel"
```

---

### Task 10: Manual integration test

- [ ] **Step 1: Run all automated tests**

Run: `pnpm test 2>&1 | tail -10`
Expected: All tests pass

- [ ] **Step 2: Run typecheck**

Run: `pnpm typecheck 2>&1 | tail -5`
Expected: All tasks successful

- [ ] **Step 3: Run build**

Run: `pnpm build 2>&1 | tail -10`
Expected: Build succeeds

- [ ] **Step 4: Manual dev test**

Run: `pnpm dev`

Test scenarios:

1. Open AI panel, type "What notes do I have about React?" — should see tool calls for search_notes executing automatically
2. Ask "Create a note about TypeScript best practices" — should see confirmation dialog for create_note
3. Cancel a confirmation — should show "cancelled" status
4. Verify max 5 round-trips by asking a complex question

- [ ] **Step 5: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix(desktop): address integration test findings"
```

---

## Deferred to Follow-Up

The following items from the spec are **intentionally deferred** to a follow-up PR:

- **`insert_text` and `replace_selection` tools** — These renderer-executed tools need additional IPC channels (`ai:tool-execute-in-renderer`, `ai:tool-renderer-result`) and preload methods (`onToolExecuteRequest`, `sendToolResult`). The registry pattern supports them, but the cross-process execution adds complexity that warrants its own PR.
- **Parallel tool execution** — Current implementation executes tools sequentially. Could be optimized to run auto-execute tools in parallel with a concurrency limit of 3.
- **`args: unknown` → `Record<string, unknown>`** — The existing `LLMEvent.tool_call.args` is typed as `unknown`. Consider tightening to `Record<string, unknown>` in a separate type-cleanup PR.
