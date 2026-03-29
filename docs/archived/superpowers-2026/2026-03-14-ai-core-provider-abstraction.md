# AI Core — Provider Abstraction & Streaming Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded Claude client with a provider-agnostic, streaming-first AI architecture that fixes rate-limit errors, truncated responses, and prepares for multi-provider support.

**Architecture:** New `packages/ai-core` package with `LLMProvider` interface + `LLMEvent` streaming protocol. `AnthropicProvider` as first implementation using fetch-based SSE parsing. `AIService` orchestrator in main process with retry, token budgeting, and IPC batching.

**Tech Stack:** TypeScript (pure, no Electron deps in ai-core), Vitest for tests, pnpm workspace, Electron IPC for streaming bridge.

**Spec:** `docs/superpowers/specs/2026-03-14-ai-core-provider-abstraction-design.md`

---

## File Structure

### New files (packages/ai-core)

| File                                                  | Responsibility                                                          |
| ----------------------------------------------------- | ----------------------------------------------------------------------- |
| `packages/ai-core/package.json`                       | Package manifest (pure TS, zero deps)                                   |
| `packages/ai-core/tsconfig.json`                      | TypeScript config extending base                                        |
| `packages/ai-core/src/index.ts`                       | Public API re-exports                                                   |
| `packages/ai-core/src/types.ts`                       | `LLMEvent`, `ChatMessage`, `ContentPart`, `LLMErrorCode`, `ChatOptions` |
| `packages/ai-core/src/provider.ts`                    | `LLMProvider`, `ProviderConfig`, `ModelInfo`, `FetchFn`                 |
| `packages/ai-core/src/provider-registry.ts`           | `ProviderRegistry` class                                                |
| `packages/ai-core/src/context-builder.ts`             | `buildContext()` + token estimation + system prompts                    |
| `packages/ai-core/src/retry.ts`                       | `withRetry()` + `classifyError()`                                       |
| `packages/ai-core/src/ai-service.ts`                  | `AIServiceImpl` orchestrator                                            |
| `packages/ai-core/src/providers/anthropic.ts`         | `AnthropicProvider` (SSE parser + event normalization)                  |
| `packages/ai-core/src/providers/sse-parser.ts`        | Reusable SSE stream parser                                              |
| `packages/ai-core/tests/types.test.ts`                | Event protocol type tests                                               |
| `packages/ai-core/tests/context-builder.test.ts`      | Context building + trimming tests                                       |
| `packages/ai-core/tests/retry.test.ts`                | Retry logic tests                                                       |
| `packages/ai-core/tests/provider-registry.test.ts`    | Registry tests                                                          |
| `packages/ai-core/tests/ai-service.test.ts`           | AIService orchestration tests                                           |
| `packages/ai-core/tests/providers/anthropic.test.ts`  | Anthropic provider tests (mocked fetch)                                 |
| `packages/ai-core/tests/providers/sse-parser.test.ts` | SSE parser tests                                                        |

### New files (apps/desktop)

| File                                 | Responsibility                                    |
| ------------------------------------ | ------------------------------------------------- |
| `apps/desktop/src/main/ai/ipc-ai.ts` | IPC bridge + batching + cleanup + preset handlers |
| `apps/desktop/src/main/ai/setup.ts`  | Provider registry setup, `net.fetch` injection    |

### Modified files

| File                                                              | Change                                                                                                                             |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `apps/desktop/src/main/index.ts`                                  | Remove `registerAiHandlers()` function (lines 2185-2277), replace call (line 2421) with import from `ai/setup.ts`                  |
| `apps/desktop/src/preload/index.ts`                               | Replace `ai.query()` with `ai.chat()` + `ai.onEvent()` + `ai.cancel()` + `ai.validate()`                                           |
| `apps/desktop/src/renderer/components/ai/AiPanel.tsx`             | Refactor from await-response to event-driven streaming. Replace `ClaudeMessage` with `ChatMessage`, remove `buildRagPrompt` import |
| `apps/desktop/src/renderer/App.tsx`                               | Update imports: `AiPanelMode` and `NoteContext` from `@readied/ai-core` instead of `@readied/ai-assistant`                         |
| `apps/desktop/src/renderer/hooks/useRegisterPluginAiCommands.ts`  | Update `resolveTemplate` import from `@readied/ai-core`                                                                            |
| `apps/desktop/src/renderer/stores/settings/schema.ts`             | Extend `AiSettings` with `provider` field                                                                                          |
| `apps/desktop/src/renderer/pages/settings/sections/AiSection.tsx` | Update imports, add provider selector, refactor test-connection to use `ai.validate()`                                             |
| `apps/desktop/package.json`                                       | Replace `@readied/ai-assistant` dep with `@readied/ai-core`                                                                        |

### Kept as-is

| File                                                              | Notes                                               |
| ----------------------------------------------------------------- | --------------------------------------------------- |
| `packages/ai-assistant/src/aiCommandTypes.ts`                     | Moved to `packages/ai-core/src/ai-command-types.ts` |
| `apps/desktop/src/renderer/components/ai/AiMessage.tsx`           | No changes needed                                   |
| `apps/desktop/src/renderer/pages/settings/sections/AiSection.tsx` | Minor: update imports, add provider selector        |

---

## Chunk 1: Package Scaffold + Types + Tests

### Task 1: Create `packages/ai-core` package scaffold

**Files:**

- Create: `packages/ai-core/package.json`
- Create: `packages/ai-core/tsconfig.json`
- Create: `packages/ai-core/src/index.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@readied/ai-core",
  "version": "0.1.0",
  "private": true,
  "description": "Provider-agnostic AI core with streaming protocol",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "import": "./src/index.ts"
    }
  },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.7.2",
    "vitest": "^2.1.8"
  },
  "license": "MIT"
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create empty index.ts**

```typescript
// packages/ai-core/src/index.ts
// Re-exports added as modules are created
```

- [ ] **Step 4: Install dependencies**

Run: `cd /Users/tomasmaritano/Documents/Github/readied/readide && pnpm install`
Expected: Success, `@readied/ai-core` appears in workspace

- [ ] **Step 5: Verify typecheck**

Run: `cd packages/ai-core && pnpm typecheck`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add packages/ai-core/package.json packages/ai-core/tsconfig.json packages/ai-core/src/index.ts
git commit -m "chore: scaffold packages/ai-core package"
```

---

### Task 2: Define core types (`types.ts`)

**Files:**

- Create: `packages/ai-core/src/types.ts`
- Create: `packages/ai-core/tests/types.test.ts`
- Modify: `packages/ai-core/src/index.ts`

- [ ] **Step 1: Write the type tests**

```typescript
// packages/ai-core/tests/types.test.ts
import { describe, it, expect } from 'vitest';
import type {
  LLMEvent,
  ChatMessage,
  MessageContent,
  ContentPart,
  LLMErrorCode,
} from '../src/types';

describe('LLMEvent protocol', () => {
  it('discriminates events by type field', () => {
    const event: LLMEvent = { type: 'text', delta: 'hello' };
    expect(event.type).toBe('text');

    // Type narrowing works
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/ai-core && pnpm test`
Expected: FAIL — cannot resolve `../src/types`

- [ ] **Step 3: Write types.ts**

```typescript
// packages/ai-core/src/types.ts

// ─── Event Protocol ─────────────────────────────────────────

type BaseEvent = {
  metadata?: Record<string, unknown>;
};

export type LLMErrorCode =
  | 'rate_limit'
  | 'auth_failed'
  | 'context_overflow'
  | 'model_not_found'
  | 'network'
  | 'provider_error'
  | 'cancelled'
  | 'timeout';

export type LLMEvent =
  | ({ type: 'start'; model: string; requestId: string; provider: string } & BaseEvent)
  | ({ type: 'text'; delta: string } & BaseEvent)
  | ({ type: 'tool_call'; id: string; name: string; args: unknown } & BaseEvent)
  | ({ type: 'tool_result'; callId: string; result: unknown } & BaseEvent)
  | ({ type: 'usage'; inputTokens: number; outputTokens: number } & BaseEvent)
  | ({ type: 'error'; code: LLMErrorCode; error: string; retryable: boolean } & BaseEvent)
  | ({ type: 'done'; durationMs: number; cancelled?: boolean } & BaseEvent);

// ─── Chat Types ─────────────────────────────────────────────

export type ContentPart = { type: 'text'; text: string } | { type: 'image'; url: string };

export type MessageContent = string | ContentPart[];

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: MessageContent;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ChatOptions {
  model: string;
  system: string;
  messages: ChatMessage[];
  maxTokens: number;
  signal?: AbortSignal;
  tools?: ToolDefinition[];
}
```

- [ ] **Step 4: Export from index.ts**

```typescript
// packages/ai-core/src/index.ts
export type {
  LLMEvent,
  LLMErrorCode,
  ContentPart,
  MessageContent,
  ChatMessage,
  ToolDefinition,
  ChatOptions,
} from './types.js';
```

- [ ] **Step 5: Run tests**

Run: `cd packages/ai-core && pnpm test`
Expected: All pass

- [ ] **Step 6: Commit**

```bash
git add packages/ai-core/src/types.ts packages/ai-core/tests/types.test.ts packages/ai-core/src/index.ts
git commit -m "feat(ai-core): define LLMEvent protocol and chat types"
```

---

### Task 3: Define provider interface (`provider.ts`)

**Files:**

- Create: `packages/ai-core/src/provider.ts`
- Create: `packages/ai-core/tests/provider-registry.test.ts`
- Create: `packages/ai-core/src/provider-registry.ts`
- Modify: `packages/ai-core/src/index.ts`

- [ ] **Step 1: Write provider-registry test**

```typescript
// packages/ai-core/tests/provider-registry.test.ts
import { describe, it, expect } from 'vitest';
import { ProviderRegistry } from '../src/provider-registry';
import type { LLMProvider, ProviderConfig, ChatOptions, ModelInfo } from '../src/provider';
import type { LLMEvent } from '../src/types';

function createMockProvider(id: string): LLMProvider {
  return {
    id,
    displayName: `Mock ${id}`,
    async *chat(_options: ChatOptions, _config: ProviderConfig): AsyncIterable<LLMEvent> {
      yield { type: 'text', delta: 'hello' };
    },
    async validate(_config: ProviderConfig) {
      return { ok: true as const };
    },
    async listModels(_config: ProviderConfig): Promise<ModelInfo[]> {
      return [
        {
          id: 'test-model',
          displayName: 'Test',
          contextWindow: 4096,
          maxOutputTokens: 1024,
          supportsStreaming: true,
          supportsTools: false,
        },
      ];
    },
  };
}

describe('ProviderRegistry', () => {
  it('registers and retrieves a provider', () => {
    const registry = new ProviderRegistry();
    const provider = createMockProvider('test');
    registry.register(provider);
    expect(registry.get('test')).toBe(provider);
  });

  it('throws on unknown provider', () => {
    const registry = new ProviderRegistry();
    expect(() => registry.get('unknown')).toThrow('Unknown provider: unknown');
  });

  it('lists all registered providers', () => {
    const registry = new ProviderRegistry();
    registry.register(createMockProvider('a'));
    registry.register(createMockProvider('b'));
    expect(registry.list().map(p => p.id)).toEqual(['a', 'b']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/ai-core && pnpm test`
Expected: FAIL — cannot resolve modules

- [ ] **Step 3: Write provider.ts**

```typescript
// packages/ai-core/src/provider.ts
import type { LLMEvent, ChatOptions } from './types.js';

// ─── Fetch Function Injection ───────────────────────────────

export type FetchFn = (
  url: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body: string;
    signal?: AbortSignal;
  }
) => Promise<{
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
  body: ReadableStream<Uint8Array> | null;
}>;

// ─── Provider Config ────────────────────────────────────────

export interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  options?: Record<string, unknown>;
}

// ─── Model Info ─────────────────────────────────────────────

export interface ModelInfo {
  id: string;
  displayName: string;
  contextWindow: number;
  maxOutputTokens: number;
  supportsStreaming: boolean;
  supportsTools: boolean;
}

// ─── Provider Interface ─────────────────────────────────────

export interface LLMProvider {
  readonly id: string;
  readonly displayName: string;

  chat(options: ChatOptions, config: ProviderConfig): AsyncIterable<LLMEvent>;
  validate(config: ProviderConfig): Promise<{ ok: boolean; error?: string }>;
  listModels(config: ProviderConfig): Promise<ModelInfo[]>;
}
```

- [ ] **Step 4: Write provider-registry.ts**

```typescript
// packages/ai-core/src/provider-registry.ts
import type { LLMProvider } from './provider.js';

export class ProviderRegistry {
  private providers = new Map<string, LLMProvider>();

  register(provider: LLMProvider): void {
    this.providers.set(provider.id, provider);
  }

  get(id: string): LLMProvider {
    const provider = this.providers.get(id);
    if (!provider) throw new Error(`Unknown provider: ${id}`);
    return provider;
  }

  list(): LLMProvider[] {
    return [...this.providers.values()];
  }
}
```

- [ ] **Step 5: Update index.ts exports**

```typescript
// packages/ai-core/src/index.ts
export type {
  LLMEvent,
  LLMErrorCode,
  ContentPart,
  MessageContent,
  ChatMessage,
  ToolDefinition,
  ChatOptions,
} from './types.js';

export type { FetchFn, ProviderConfig, ModelInfo, LLMProvider } from './provider.js';

export { ProviderRegistry } from './provider-registry.js';
```

- [ ] **Step 6: Run tests**

Run: `cd packages/ai-core && pnpm test`
Expected: All pass

- [ ] **Step 7: Commit**

```bash
git add packages/ai-core/src/provider.ts packages/ai-core/src/provider-registry.ts packages/ai-core/tests/provider-registry.test.ts packages/ai-core/src/index.ts
git commit -m "feat(ai-core): add LLMProvider interface and ProviderRegistry"
```

---

## Chunk 2: ContextBuilder + Retry Logic

### Task 4: Implement ContextBuilder

**Files:**

- Create: `packages/ai-core/src/context-builder.ts`
- Create: `packages/ai-core/tests/context-builder.test.ts`
- Modify: `packages/ai-core/src/index.ts`

- [ ] **Step 1: Write context-builder tests**

```typescript
// packages/ai-core/tests/context-builder.test.ts
import { describe, it, expect } from 'vitest';
import { buildContext, estimateTokens, estimateMessageTokens } from '../src/context-builder';
import type { ChatMessage } from '../src/types';

describe('estimateTokens', () => {
  it('estimates ~4 chars per token', () => {
    expect(estimateTokens('hello world')).toBe(3); // 11 chars / 4 = 2.75 → 3
  });

  it('returns 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });
});

describe('estimateMessageTokens', () => {
  it('handles string content', () => {
    expect(estimateMessageTokens('hello world')).toBe(3);
  });

  it('handles ContentPart array with text', () => {
    expect(estimateMessageTokens([{ type: 'text', text: 'hello world' }])).toBe(3);
  });

  it('handles image parts with fixed estimate', () => {
    expect(
      estimateMessageTokens([
        { type: 'text', text: 'hi' },
        { type: 'image', url: 'data:...' },
      ])
    ).toBe(1 + 1000); // 1 token for "hi" + 1000 for image
  });
});

describe('buildContext', () => {
  const systemPrompt = 'You are a helpful assistant.';

  it('includes system prompt always', () => {
    const result = buildContext(
      { systemPrompt, history: [], relevantNotes: [] },
      { maxContextTokens: 1000, maxResponseTokens: 100 }
    );
    expect(result.system).toContain(systemPrompt);
    expect(result.truncated).toBe(false);
  });

  it('includes current note in system prompt', () => {
    const result = buildContext(
      {
        systemPrompt,
        currentNote: { id: '1', title: 'Test Note', content: 'Some content here' },
        history: [],
        relevantNotes: [],
      },
      { maxContextTokens: 10000, maxResponseTokens: 100 }
    );
    expect(result.system).toContain('Test Note');
    expect(result.system).toContain('Some content here');
  });

  it('includes conversation history newest-first priority', () => {
    const history: ChatMessage[] = [
      { role: 'user', content: 'first message' },
      { role: 'assistant', content: 'first reply' },
      { role: 'user', content: 'second message' },
      { role: 'assistant', content: 'second reply' },
    ];
    const result = buildContext(
      { systemPrompt, history, relevantNotes: [] },
      { maxContextTokens: 10000, maxResponseTokens: 100 }
    );
    expect(result.messages).toHaveLength(4);
  });

  it('drops oldest history messages when budget exceeded', () => {
    const longMsg = 'x'.repeat(400); // ~100 tokens each
    const history: ChatMessage[] = Array.from({ length: 20 }, (_, i) => ({
      role: i % 2 === 0 ? ('user' as const) : ('assistant' as const),
      content: longMsg,
    }));
    const result = buildContext(
      { systemPrompt, history, relevantNotes: [] },
      { maxContextTokens: 500, maxResponseTokens: 100 } // only ~400 tokens available
    );
    expect(result.messages.length).toBeLessThan(20);
    expect(result.truncated).toBe(true);
    // Newest messages should be kept
    expect(result.messages[result.messages.length - 1]?.content).toBe(longMsg);
  });

  it('includes relevant notes filling remaining budget', () => {
    const result = buildContext(
      {
        systemPrompt,
        history: [],
        relevantNotes: [
          { id: '1', title: 'Note A', content: 'Content A' },
          { id: '2', title: 'Note B', content: 'Content B' },
        ],
      },
      { maxContextTokens: 10000, maxResponseTokens: 100 }
    );
    expect(result.system).toContain('Note A');
    expect(result.system).toContain('Note B');
    expect(result.notesIncluded).toBe(2);
  });

  it('drops notes that exceed budget', () => {
    const hugeContent = 'x'.repeat(40000); // ~10K tokens
    const result = buildContext(
      {
        systemPrompt,
        history: [],
        relevantNotes: [
          { id: '1', title: 'Small', content: 'small' },
          { id: '2', title: 'Huge', content: hugeContent },
        ],
      },
      { maxContextTokens: 500, maxResponseTokens: 100 }
    );
    expect(result.notesIncluded).toBe(1);
    expect(result.system).toContain('Small');
    expect(result.truncated).toBe(true);
  });

  it('returns token estimate', () => {
    const result = buildContext(
      { systemPrompt, history: [], relevantNotes: [] },
      { maxContextTokens: 10000, maxResponseTokens: 100 }
    );
    expect(result.tokenEstimate).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/ai-core && pnpm test`
Expected: FAIL — cannot resolve `../src/context-builder`

- [ ] **Step 3: Write context-builder.ts**

```typescript
// packages/ai-core/src/context-builder.ts
import type { ChatMessage, MessageContent } from './types.js';

// ─── Types ──────────────────────────────────────────────────

export interface NoteContext {
  id: string;
  title: string;
  content: string;
}

export interface ContextSources {
  systemPrompt: string;
  currentNote?: NoteContext | null;
  history: ChatMessage[];
  relevantNotes: NoteContext[];
  toolResults?: Array<{ callId: string; result: unknown }>;
}

export interface ContextBudget {
  maxContextTokens: number;
  maxResponseTokens: number;
}

export interface ContextBuildResult {
  system: string;
  messages: ChatMessage[];
  tokenEstimate: number;
  truncated: boolean;
  notesIncluded: number;
}

// ─── Token Estimation ───────────────────────────────────────

export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

export function estimateMessageTokens(content: MessageContent): number {
  if (typeof content === 'string') return estimateTokens(content);
  return content.reduce((sum, part) => {
    if (part.type === 'text') return sum + estimateTokens(part.text);
    if (part.type === 'image') return sum + 1000;
    return sum;
  }, 0);
}

// ─── System Prompts ─────────────────────────────────────────

export const SYSTEM_PROMPT = `You are an AI assistant embedded in Readied, a markdown note-taking app.
You help users with their notes: answering questions, summarizing content, suggesting improvements, and generating new content.

Guidelines:
- Be concise and helpful
- Format responses in markdown
- When referencing notes, mention their titles
- Respect the user's writing style
- Never fabricate information not present in the provided context`;

export const ASK_NOTES_SYSTEM_PROMPT = `You are an AI assistant embedded in Readied, a markdown note-taking app.
You are in "Ask Your Notes" mode. Your primary job is to answer the user's question using ONLY the notes provided as context.

Guidelines:
- Answer based on the content found in the user's notes
- If the notes do not contain enough information, say so clearly
- Cite note titles when referencing information
- Format responses in markdown
- Be concise and helpful
- Never fabricate information not present in the provided notes`;

export const SUMMARIZE_SYSTEM_PROMPT = `You are a concise summarizer. Produce a clear, accurate summary in markdown. Do not add information that is not present in the source text.`;
export const SUMMARIZE_USER_TEMPLATE = `Summarize the following text concisely:\n\n{{selection}}`;
export const REWRITE_SYSTEM_PROMPT = `You are a skilled editor. Rewrite the provided text to improve clarity, flow, and readability while preserving the original meaning. Output only the rewritten text in markdown.`;
export const REWRITE_USER_TEMPLATE = `Rewrite the following text to improve clarity:\n\n{{selection}}`;
export const TWEET_SYSTEM_PROMPT = `You are a social media copywriter. Convert the provided text into a single tweet (max 280 characters). Be punchy and engaging. Output only the tweet text, no quotes or labels.`;
export const TWEET_USER_TEMPLATE = `Convert this into a tweet (max 280 chars):\n\n{{selection}}`;

// ─── Context Builder ────────────────────────────────────────

function formatCurrentNote(note: NoteContext): string {
  return `\n\nThe user is currently viewing this note:\n\n--- Current Note: "${note.title}" ---\n${note.content}`;
}

function truncateToTokens(text: string, maxTokens: number): string {
  const maxChars = maxTokens * 4;
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + '\n\n[... truncated]';
}

export function buildContext(sources: ContextSources, budget: ContextBudget): ContextBuildResult {
  const available = budget.maxContextTokens - budget.maxResponseTokens;
  let used = 0;
  let truncated = false;

  // 1. System prompt (always fits)
  let system = sources.systemPrompt;
  used += estimateTokens(system);

  // 2. Current note (high priority, truncate if huge)
  if (sources.currentNote) {
    const noteText = formatCurrentNote(sources.currentNote);
    const noteTokens = estimateTokens(noteText);
    if (used + noteTokens <= available * 0.5) {
      system += noteText;
      used += noteTokens;
    } else {
      const truncatedNote = truncateToTokens(noteText, (available - used) * 0.4);
      system += truncatedNote;
      used += estimateTokens(truncatedNote);
      truncated = true;
    }
  }

  // 3. Conversation history (newest turns first, drop oldest on overflow)
  const messages: ChatMessage[] = [];
  const reversedHistory = [...sources.history].reverse();
  for (const msg of reversedHistory) {
    const msgTokens = estimateMessageTokens(msg.content);
    if (used + msgTokens > available * 0.8) {
      truncated = true;
      break;
    }
    messages.unshift(msg);
    used += msgTokens;
  }

  // 4. Relevant notes (fill remaining budget)
  let notesIncluded = 0;
  if (sources.relevantNotes.length > 0) {
    const notesSections: string[] = [];
    for (const note of sources.relevantNotes) {
      const section = `--- Note: "${note.title}" ---\n${note.content}`;
      const sectionTokens = estimateTokens(section);
      if (used + sectionTokens > available) {
        truncated = true;
        break;
      }
      notesSections.push(section);
      used += sectionTokens;
      notesIncluded++;
    }
    if (notesSections.length > 0) {
      system += `\n\nRelevant notes from user's knowledge base:\n\n${notesSections.join('\n\n')}`;
    }
  }

  return { system, messages, tokenEstimate: used, truncated, notesIncluded };
}
```

- [ ] **Step 4: Update index.ts exports**

Add to `packages/ai-core/src/index.ts`:

```typescript
export {
  buildContext,
  estimateTokens,
  estimateMessageTokens,
  SYSTEM_PROMPT,
  ASK_NOTES_SYSTEM_PROMPT,
  SUMMARIZE_SYSTEM_PROMPT,
  SUMMARIZE_USER_TEMPLATE,
  REWRITE_SYSTEM_PROMPT,
  REWRITE_USER_TEMPLATE,
  TWEET_SYSTEM_PROMPT,
  TWEET_USER_TEMPLATE,
} from './context-builder.js';

export type {
  NoteContext,
  ContextSources,
  ContextBudget,
  ContextBuildResult,
} from './context-builder.js';
```

- [ ] **Step 5: Run tests**

Run: `cd packages/ai-core && pnpm test`
Expected: All pass

- [ ] **Step 6: Commit**

```bash
git add packages/ai-core/src/context-builder.ts packages/ai-core/tests/context-builder.test.ts packages/ai-core/src/index.ts
git commit -m "feat(ai-core): add ContextBuilder with token budgeting and trimming"
```

---

### Task 5: Implement retry logic

**Files:**

- Create: `packages/ai-core/src/retry.ts`
- Create: `packages/ai-core/tests/retry.test.ts`
- Modify: `packages/ai-core/src/index.ts`

- [ ] **Step 1: Write retry tests**

```typescript
// packages/ai-core/tests/retry.test.ts
import { describe, it, expect, vi } from 'vitest';
import { withRetry, classifyError } from '../src/retry';
import type { LLMEvent } from '../src/types';

async function collectEvents(iterable: AsyncIterable<LLMEvent>): Promise<LLMEvent[]> {
  const events: LLMEvent[] = [];
  for await (const event of iterable) {
    events.push(event);
  }
  return events;
}

describe('classifyError', () => {
  it('classifies 429 as rate_limit', () => {
    expect(classifyError(new Error('API error 429: rate limit'))).toBe('rate_limit');
  });

  it('classifies 401 as auth_failed', () => {
    expect(classifyError(new Error('401 Unauthorized'))).toBe('auth_failed');
  });

  it('classifies AbortError as cancelled', () => {
    const err = new DOMException('Aborted', 'AbortError');
    expect(classifyError(err)).toBe('cancelled');
  });

  it('classifies network errors', () => {
    expect(classifyError(new Error('fetch failed: network error'))).toBe('network');
  });

  it('defaults to provider_error', () => {
    expect(classifyError(new Error('something weird'))).toBe('provider_error');
  });
});

describe('withRetry', () => {
  it('passes through events on success', async () => {
    async function* success(): AsyncIterable<LLMEvent> {
      yield { type: 'text', delta: 'hello' };
      yield { type: 'done', durationMs: 100 };
    }

    const events = await collectEvents(
      withRetry(() => success(), {
        maxRetries: 3,
        baseDelay: 10,
        maxDelay: 100,
        jitter: false,
        retryableCodes: ['rate_limit'],
      })
    );
    expect(events).toHaveLength(2);
    expect(events[0]?.type).toBe('text');
    expect(events[1]?.type).toBe('done');
  });

  it('retries on retryable error and succeeds', async () => {
    let attempt = 0;
    function makeStream(): AsyncIterable<LLMEvent> {
      return {
        [Symbol.asyncIterator]() {
          attempt++;
          if (attempt === 1) {
            return {
              async next() {
                return {
                  done: false,
                  value: {
                    type: 'error' as const,
                    code: 'rate_limit' as const,
                    error: '429',
                    retryable: true,
                  },
                };
              },
            };
          }
          let yielded = false;
          return {
            async next() {
              if (!yielded) {
                yielded = true;
                return { done: false, value: { type: 'text' as const, delta: 'success' } };
              }
              return { done: false, value: { type: 'done' as const, durationMs: 50 } };
            },
          };
        },
      };
    }

    const events = await collectEvents(
      withRetry(() => makeStream(), {
        maxRetries: 3,
        baseDelay: 10,
        maxDelay: 100,
        jitter: false,
        retryableCodes: ['rate_limit'],
      })
    );

    // Should contain an intermediate retry error event, then success
    const textEvents = events.filter(e => e.type === 'text');
    expect(textEvents.length).toBeGreaterThanOrEqual(1);
  });

  it('gives up after max retries', async () => {
    async function* alwaysFail(): AsyncIterable<LLMEvent> {
      yield { type: 'error', code: 'rate_limit' as const, error: '429', retryable: true };
    }

    const events = await collectEvents(
      withRetry(() => alwaysFail(), {
        maxRetries: 2,
        baseDelay: 10,
        maxDelay: 50,
        jitter: false,
        retryableCodes: ['rate_limit'],
      })
    );

    const finalError = events.filter(e => e.type === 'error').pop();
    expect(finalError).toBeDefined();
    if (finalError?.type === 'error') {
      expect(finalError.retryable).toBe(false);
    }
  });

  it('does not retry non-retryable errors', async () => {
    async function* authFail(): AsyncIterable<LLMEvent> {
      yield { type: 'error', code: 'auth_failed' as const, error: '401', retryable: false };
    }

    const events = await collectEvents(
      withRetry(() => authFail(), {
        maxRetries: 3,
        baseDelay: 10,
        maxDelay: 100,
        jitter: false,
        retryableCodes: ['rate_limit'],
      })
    );

    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe('error');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/ai-core && pnpm test`
Expected: FAIL — cannot resolve `../src/retry`

- [ ] **Step 3: Write retry.ts**

```typescript
// packages/ai-core/src/retry.ts
import type { LLMEvent, LLMErrorCode } from './types.js';

export interface RetryOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  jitter: boolean;
  retryableCodes: LLMErrorCode[];
}

const DEFAULT_RETRY: RetryOptions = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30_000,
  jitter: true,
  retryableCodes: ['rate_limit', 'network', 'provider_error'],
};

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function calculateDelay(attempt: number, opts: RetryOptions): number {
  const exponential = Math.min(opts.baseDelay * 2 ** attempt, opts.maxDelay);
  if (!opts.jitter) return exponential;
  return exponential * (0.5 + Math.random() * 0.5);
}

export function classifyError(err: unknown): LLMErrorCode {
  if (err instanceof Error) {
    if (err.name === 'AbortError') return 'cancelled';
    const msg = err.message.toLowerCase();
    if (msg.includes('429') || msg.includes('rate limit') || msg.includes('rate_limit'))
      return 'rate_limit';
    if (msg.includes('401') || msg.includes('unauthorized') || msg.includes('invalid.*key'))
      return 'auth_failed';
    if (msg.includes('context') || msg.includes('too long') || msg.includes('too many tokens'))
      return 'context_overflow';
    if (msg.includes('404')) return 'model_not_found';
    if (msg.includes('fetch') || msg.includes('network') || msg.includes('econnrefused'))
      return 'network';
    if (msg.includes('timeout') || msg.includes('timed out')) return 'timeout';
  }
  return 'provider_error';
}

export async function* withRetry(
  fn: () => AsyncIterable<LLMEvent>,
  options: Partial<RetryOptions> = {}
): AsyncIterable<LLMEvent> {
  const opts = { ...DEFAULT_RETRY, ...options };
  let lastError: LLMEvent | null = null;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      let hadRetryableError = false;

      for await (const event of fn()) {
        if (
          event.type === 'error' &&
          event.retryable &&
          opts.retryableCodes.includes(event.code) &&
          attempt < opts.maxRetries
        ) {
          lastError = event;
          hadRetryableError = true;
          break;
        }
        yield event;
        if (event.type === 'done') return;
      }

      if (!hadRetryableError) return;

      const delay = calculateDelay(attempt, opts);
      yield {
        type: 'error',
        code: (lastError as Extract<LLMEvent, { type: 'error' }>).code,
        error: `Retrying in ${Math.round(delay / 1000)}s (attempt ${attempt + 2}/${opts.maxRetries + 1})`,
        retryable: true,
        metadata: { retryAttempt: attempt + 1, delayMs: delay },
      };
      await sleep(delay);
    } catch (err) {
      const code = classifyError(err);
      if (!opts.retryableCodes.includes(code) || attempt >= opts.maxRetries) {
        yield {
          type: 'error',
          code,
          error: err instanceof Error ? err.message : String(err),
          retryable: false,
        };
        return;
      }
      const delay = calculateDelay(attempt, opts);
      await sleep(delay);
    }
  }

  if (lastError) {
    yield { ...(lastError as Extract<LLMEvent, { type: 'error' }>), retryable: false };
  }
}
```

- [ ] **Step 4: Update index.ts exports**

Add to `packages/ai-core/src/index.ts`:

```typescript
export { withRetry, classifyError } from './retry.js';
export type { RetryOptions } from './retry.js';
```

- [ ] **Step 5: Run tests**

Run: `cd packages/ai-core && pnpm test`
Expected: All pass

- [ ] **Step 6: Commit**

```bash
git add packages/ai-core/src/retry.ts packages/ai-core/tests/retry.test.ts packages/ai-core/src/index.ts
git commit -m "feat(ai-core): add retry logic with exponential backoff and jitter"
```

---

## Chunk 3: AnthropicProvider + SSE Parser

### Task 6: Implement SSE parser

**Files:**

- Create: `packages/ai-core/src/providers/sse-parser.ts`
- Create: `packages/ai-core/tests/providers/sse-parser.test.ts`

- [ ] **Step 1: Write SSE parser tests**

```typescript
// packages/ai-core/tests/providers/sse-parser.test.ts
import { describe, it, expect } from 'vitest';
import { parseSSEStream } from '../../src/providers/sse-parser';

function createReadableStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

describe('parseSSEStream', () => {
  it('parses simple SSE events', async () => {
    const stream = createReadableStream([
      'event: message_start\ndata: {"type":"message_start"}\n\n',
      'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}\n\n',
    ]);

    const events: Array<{ event: string; data: unknown }> = [];
    for await (const event of parseSSEStream(stream)) {
      events.push(event);
    }
    expect(events).toHaveLength(2);
    expect(events[0]?.event).toBe('message_start');
    expect(events[1]?.event).toBe('content_block_delta');
  });

  it('handles chunked data split across boundaries', async () => {
    const stream = createReadableStream([
      'event: content_block_del',
      'ta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hi"}}\n\n',
    ]);

    const events: Array<{ event: string; data: unknown }> = [];
    for await (const event of parseSSEStream(stream)) {
      events.push(event);
    }
    expect(events).toHaveLength(1);
  });

  it('skips empty lines and comments', async () => {
    const stream = createReadableStream([
      ': this is a comment\n\n',
      'event: message_start\ndata: {"type":"message_start"}\n\n',
    ]);

    const events: Array<{ event: string; data: unknown }> = [];
    for await (const event of parseSSEStream(stream)) {
      events.push(event);
    }
    expect(events).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/ai-core && pnpm test`
Expected: FAIL

- [ ] **Step 3: Write sse-parser.ts**

```typescript
// packages/ai-core/src/providers/sse-parser.ts

export interface SSEEvent {
  event: string;
  data: unknown;
}

export async function* parseSSEStream(body: ReadableStream<Uint8Array>): AsyncIterable<SSEEvent> {
  const decoder = new TextDecoder();
  const reader = body.getReader();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process complete events (terminated by double newline)
      const parts = buffer.split('\n\n');
      // Last part might be incomplete
      buffer = parts.pop() ?? '';

      for (const part of parts) {
        const trimmed = part.trim();
        if (!trimmed || trimmed.startsWith(':')) continue;

        let eventType = 'message';
        let dataStr = '';

        for (const line of trimmed.split('\n')) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            dataStr += line.slice(6);
          } else if (line.startsWith('data:')) {
            dataStr += line.slice(5);
          }
        }

        if (dataStr) {
          try {
            yield { event: eventType, data: JSON.parse(dataStr) };
          } catch {
            // Skip malformed JSON
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
```

- [ ] **Step 4: Run tests**

Run: `cd packages/ai-core && pnpm test`
Expected: All pass

- [ ] **Step 5: Commit**

```bash
git add packages/ai-core/src/providers/sse-parser.ts packages/ai-core/tests/providers/sse-parser.test.ts
git commit -m "feat(ai-core): add reusable SSE stream parser"
```

---

### Task 7: Implement AnthropicProvider

**Files:**

- Create: `packages/ai-core/src/providers/anthropic.ts`
- Create: `packages/ai-core/tests/providers/anthropic.test.ts`
- Modify: `packages/ai-core/src/index.ts`

- [ ] **Step 1: Write AnthropicProvider tests**

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/ai-core && pnpm test`
Expected: FAIL

- [ ] **Step 3: Write anthropic.ts**

```typescript
// packages/ai-core/src/providers/anthropic.ts
import type { LLMProvider, ProviderConfig, ModelInfo, FetchFn } from '../provider.js';
import type { LLMEvent, ChatOptions, MessageContent } from '../types.js';
import { parseSSEStream } from './sse-parser.js';

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';

const STATIC_MODELS: ModelInfo[] = [
  {
    id: 'claude-sonnet-4-20250514',
    displayName: 'Claude Sonnet 4',
    contextWindow: 200_000,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsTools: true,
  },
  {
    id: 'claude-haiku-4-5-20251001',
    displayName: 'Claude Haiku 4.5',
    contextWindow: 200_000,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsTools: true,
  },
  {
    id: 'claude-opus-4-20250514',
    displayName: 'Claude Opus 4',
    contextWindow: 200_000,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsTools: true,
  },
];

function classifyHttpStatus(status: number): {
  code: LLMEvent extends infer E ? (E extends { type: 'error'; code: infer C } ? C : never) : never;
  retryable: boolean;
} {
  if (status === 429 || status === 529) return { code: 'rate_limit', retryable: true };
  if (status === 401) return { code: 'auth_failed', retryable: false };
  if (status === 404) return { code: 'model_not_found', retryable: false };
  if (status === 400) return { code: 'context_overflow', retryable: false };
  if (status >= 500) return { code: 'provider_error', retryable: true };
  return { code: 'provider_error', retryable: false };
}

function normalizeContent(
  content: MessageContent
): string | Array<{ type: string; text?: string; source?: unknown }> {
  if (typeof content === 'string') return content;
  return content.map(part => {
    if (part.type === 'text') return { type: 'text', text: part.text };
    return { type: 'text', text: '[image]' }; // Placeholder — images handled in future
  });
}

export class AnthropicProvider implements LLMProvider {
  readonly id = 'anthropic';
  readonly displayName = 'Anthropic Claude';

  constructor(private fetchFn: FetchFn) {}

  async *chat(options: ChatOptions, config: ProviderConfig): AsyncIterable<LLMEvent> {
    const { model, system, messages, maxTokens, signal, tools } = options;
    const baseUrl = config.baseUrl ?? API_URL;

    const body: Record<string, unknown> = {
      model,
      max_tokens: maxTokens,
      system,
      stream: true,
      messages: messages.map(m => ({
        role: m.role,
        content: normalizeContent(m.content),
      })),
    };

    if (tools && tools.length > 0) {
      body.tools = tools.map(t => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
      }));
    }

    let response: Awaited<ReturnType<FetchFn>>;
    try {
      response = await this.fetchFn(baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.apiKey ?? '',
          'anthropic-version': API_VERSION,
        },
        body: JSON.stringify(body),
        signal,
      });
    } catch (err) {
      const isAbort = err instanceof Error && err.name === 'AbortError';
      yield {
        type: 'error',
        code: isAbort ? 'cancelled' : 'network',
        error: err instanceof Error ? err.message : String(err),
        retryable: !isAbort,
      };
      return;
    }

    if (!response.ok) {
      const errorBody = await response.text();
      const { code, retryable } = classifyHttpStatus(response.status);
      yield {
        type: 'error',
        code,
        error: `API error ${response.status}: ${errorBody}`,
        retryable,
        metadata: {
          retryAfter: response.headers.get('retry-after'),
        },
      };
      return;
    }

    if (!response.body) {
      yield { type: 'error', code: 'provider_error', error: 'No response body', retryable: false };
      return;
    }

    // Track input tokens from message_start for the usage event
    let inputTokens = 0;

    for await (const sseEvent of parseSSEStream(response.body)) {
      const data = sseEvent.data as Record<string, unknown>;

      switch (data.type) {
        case 'message_start': {
          const message = data.message as Record<string, unknown>;
          const usage = message.usage as { input_tokens: number } | undefined;
          if (usage) inputTokens = usage.input_tokens;
          break;
        }

        case 'content_block_delta': {
          const delta = data.delta as Record<string, unknown>;
          if (delta.type === 'text_delta') {
            yield { type: 'text', delta: delta.text as string };
          }
          break;
        }

        case 'message_delta': {
          const usage = data.usage as { output_tokens: number } | undefined;
          if (usage) {
            yield { type: 'usage', inputTokens, outputTokens: usage.output_tokens };
          }
          break;
        }

        case 'message_stop':
          // Provider does NOT emit 'done' — AIService handles that
          break;

        case 'error': {
          yield {
            type: 'error',
            code: 'provider_error',
            error: (data.error as Record<string, string>)?.message ?? 'Unknown streaming error',
            retryable: true,
          };
          break;
        }
      }
    }
  }

  async validate(config: ProviderConfig): Promise<{ ok: boolean; error?: string }> {
    if (!config.apiKey) {
      return { ok: false, error: 'API key is required' };
    }
    return { ok: true };
  }

  async listModels(_config: ProviderConfig): Promise<ModelInfo[]> {
    return STATIC_MODELS;
  }
}
```

- [ ] **Step 4: Update index.ts**

Add to `packages/ai-core/src/index.ts`:

```typescript
export { AnthropicProvider } from './providers/anthropic.js';
```

- [ ] **Step 5: Run tests**

Run: `cd packages/ai-core && pnpm test`
Expected: All pass

- [ ] **Step 6: Commit**

```bash
git add packages/ai-core/src/providers/ packages/ai-core/tests/providers/ packages/ai-core/src/index.ts
git commit -m "feat(ai-core): add AnthropicProvider with SSE streaming"
```

---

## Chunk 4: AIService Orchestrator

### Task 8: Implement AIService

**Files:**

- Create: `packages/ai-core/src/ai-service.ts`
- Create: `packages/ai-core/tests/ai-service.test.ts`
- Modify: `packages/ai-core/src/index.ts`

- [ ] **Step 1: Write AIService tests**

```typescript
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

    // Both should be aborted — collecting events should show cancelled
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/ai-core && pnpm test`
Expected: FAIL

- [ ] **Step 3: Write ai-service.ts**

```typescript
// packages/ai-core/src/ai-service.ts
import type { LLMEvent, ChatOptions, ChatMessage } from './types.js';
import type { ProviderConfig } from './provider.js';
import { ProviderRegistry } from './provider-registry.js';
import { buildContext, SYSTEM_PROMPT, ASK_NOTES_SYSTEM_PROMPT } from './context-builder.js';
import type { NoteContext } from './context-builder.js';
import { withRetry } from './retry.js';

// ─── Types ──────────────────────────────────────────────────

export interface ChatRequest {
  query: string;
  currentNote?: NoteContext | null;
  relevantNotes: NoteContext[];
  history: ChatMessage[];
  mode: 'chat' | 'ask-notes';
  provider: string;
  model: string;
  providerConfig: ProviderConfig;
  maxResponseTokens?: number;
}

export interface ChatHandle {
  requestId: string;
  events: AsyncIterable<LLMEvent>;
  abort: () => void;
}

export interface AIService {
  chat(request: ChatRequest): ChatHandle;
  cancelAll(): void;
}

// ─── Implementation ─────────────────────────────────────────

const DEFAULT_MAX_RESPONSE_TOKENS = 4096;

export class AIServiceImpl implements AIService {
  private activeRequests = new Map<string, AbortController>();

  constructor(private registry: ProviderRegistry) {}

  chat(request: ChatRequest): ChatHandle {
    const requestId = crypto.randomUUID();
    const controller = new AbortController();
    this.activeRequests.set(requestId, controller);

    const events = this.executeChat(requestId, request, controller.signal);

    return {
      requestId,
      events,
      abort: () => {
        controller.abort();
        this.activeRequests.delete(requestId);
      },
    };
  }

  cancelAll(): void {
    for (const controller of this.activeRequests.values()) {
      controller.abort();
    }
    this.activeRequests.clear();
  }

  private async *executeChat(
    requestId: string,
    request: ChatRequest,
    signal: AbortSignal
  ): AsyncIterable<LLMEvent> {
    const startTime = Date.now();
    const provider = this.registry.get(request.provider);
    const maxResponseTokens = request.maxResponseTokens ?? DEFAULT_MAX_RESPONSE_TOKENS;

    // Get model info for context window size
    const models = await provider.listModels(request.providerConfig);
    const modelInfo = models.find(m => m.id === request.model);
    const contextWindow = modelInfo?.contextWindow ?? 200_000;

    // Build context
    const systemPrompt = request.mode === 'ask-notes' ? ASK_NOTES_SYSTEM_PROMPT : SYSTEM_PROMPT;
    const context = buildContext(
      {
        systemPrompt,
        currentNote: request.currentNote,
        history: request.history,
        relevantNotes: request.relevantNotes,
      },
      {
        maxContextTokens: contextWindow,
        maxResponseTokens,
      }
    );

    // Add the current query to messages
    const messages: ChatMessage[] = [...context.messages, { role: 'user', content: request.query }];

    const chatOptions: ChatOptions = {
      model: request.model,
      system: context.system,
      messages,
      maxTokens: maxResponseTokens,
      signal,
    };

    // Emit start (AIService owns this)
    yield {
      type: 'start',
      model: request.model,
      requestId,
      provider: provider.id,
    };

    try {
      const stream = withRetry(() => provider.chat(chatOptions, request.providerConfig), {
        maxRetries: 3,
      });

      for await (const event of stream) {
        if (signal.aborted) break;
        yield event;
      }
    } catch (err) {
      if (!signal.aborted) {
        yield {
          type: 'error',
          code: 'provider_error',
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
}
```

- [ ] **Step 4: Update index.ts**

Add to `packages/ai-core/src/index.ts`:

```typescript
export { AIServiceImpl } from './ai-service.js';
export type { ChatRequest, ChatHandle, AIService } from './ai-service.js';
```

- [ ] **Step 5: Run tests**

Run: `cd packages/ai-core && pnpm test`
Expected: All pass

- [ ] **Step 6: Run full typecheck**

Run: `cd packages/ai-core && pnpm typecheck`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add packages/ai-core/src/ai-service.ts packages/ai-core/tests/ai-service.test.ts packages/ai-core/src/index.ts
git commit -m "feat(ai-core): add AIService orchestrator with context building and retry"
```

---

## Chunk 5: Electron Integration (IPC + Preload + Main)

### Task 9: Create IPC bridge and setup

**Files:**

- Create: `apps/desktop/src/main/ai/setup.ts`
- Create: `apps/desktop/src/main/ai/ipc-ai.ts`
- Modify: `apps/desktop/src/main/index.ts` — remove old `registerAiHandlers()`, import new setup
- Modify: `apps/desktop/package.json` — replace `@readied/ai-assistant` with `@readied/ai-core`

- [ ] **Step 1: Add @readied/ai-core dependency to desktop**

Run: `cd /Users/tomasmaritano/Documents/Github/readied/readide && pnpm --filter @readied/desktop remove @readied/ai-assistant && pnpm --filter @readied/desktop add @readied/ai-core@workspace:*`

- [ ] **Step 2: Create setup.ts**

```typescript
// apps/desktop/src/main/ai/setup.ts
import { net } from 'electron';
import { ProviderRegistry, AnthropicProvider, AIServiceImpl } from '@readied/ai-core';
import type { AIService, FetchFn } from '@readied/ai-core';

let service: AIService | null = null;

export function createAIService(): AIService {
  if (service) return service;

  const registry = new ProviderRegistry();
  registry.register(new AnthropicProvider(net.fetch as FetchFn));

  service = new AIServiceImpl(registry);
  return service;
}
```

- [ ] **Step 3: Create ipc-ai.ts**

```typescript
// apps/desktop/src/main/ai/ipc-ai.ts
import { ipcMain, app, BrowserWindow, dialog } from 'electron';
import { readFile, writeFile } from 'node:fs/promises';
import type { AIService, ChatRequest, LLMEvent, ProviderConfig } from '@readied/ai-core';
import type { ChatHandle } from '@readied/ai-core';

const BATCH_INTERVAL_MS = 50;

// Per-window active handle tracking
const activeHandles = new Map<number, Map<string, ChatHandle>>();

export function registerAIHandlers(
  service: AIService,
  getProviderConfig: () => ProviderConfig
): void {
  // ─── Streaming chat ─────────────────────────────────────
  ipcMain.handle('ai:chat', (event, request: Omit<ChatRequest, 'providerConfig'>) => {
    const windowId = event.sender.id;
    const providerConfig = getProviderConfig();

    const handle = service.chat({ ...request, providerConfig });

    // Track handle
    if (!activeHandles.has(windowId)) {
      activeHandles.set(windowId, new Map());
    }
    activeHandles.get(windowId)!.set(handle.requestId, handle);

    // Start consuming stream with batching
    consumeStream(event.sender, handle);

    return { requestId: handle.requestId };
  });

  // ─── Cancel ─────────────────────────────────────────────
  ipcMain.handle('ai:cancel', (_event, requestId: string) => {
    for (const handles of activeHandles.values()) {
      const handle = handles.get(requestId);
      if (handle) {
        handle.abort();
        handles.delete(requestId);
        return;
      }
    }
  });

  // ─── Export/Import presets (kept from old impl) ─────────
  ipcMain.handle('ai:exportPreset', async (_event, presetJson: string) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Export AI Command Preset',
      defaultPath: 'ai-commands.json',
      filters: [{ name: 'JSON Files', extensions: ['json'] }],
    });
    if (canceled || !filePath) return { ok: false, error: 'Export cancelled' };
    try {
      await writeFile(filePath, presetJson, 'utf-8');
      return { ok: true, filePath };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('ai:importPreset', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Import AI Command Preset',
      filters: [{ name: 'JSON Files', extensions: ['json'] }],
      properties: ['openFile'],
    });
    if (canceled || filePaths.length === 0) return { ok: false, error: 'Import cancelled' };
    try {
      const content = await readFile(filePaths[0]!, 'utf-8');
      return { ok: true, content };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  // ─── Cleanup on window destroy ──────────────────────────
  app.on('browser-window-created', (_event, window) => {
    window.webContents.on('destroyed', () => {
      const handles = activeHandles.get(window.webContents.id);
      if (handles) {
        for (const handle of handles.values()) handle.abort();
        activeHandles.delete(window.webContents.id);
      }
    });
  });
}

// ─── Stream consumer with batching ────────────────────────

async function consumeStream(sender: Electron.WebContents, handle: ChatHandle): Promise<void> {
  let textBuffer = '';
  let flushTimer: NodeJS.Timeout | null = null;

  const flush = () => {
    if (textBuffer && !sender.isDestroyed()) {
      sender.send('ai:event', handle.requestId, { type: 'text', delta: textBuffer });
      textBuffer = '';
    }
    flushTimer = null;
  };

  try {
    for await (const event of handle.events) {
      if (sender.isDestroyed()) {
        handle.abort();
        break;
      }

      if (event.type === 'text') {
        textBuffer += event.delta;
        if (!flushTimer) {
          flushTimer = setTimeout(flush, BATCH_INTERVAL_MS);
        }
      } else {
        // Non-text events: flush buffer first, then send immediately
        if (flushTimer) {
          clearTimeout(flushTimer);
          flushTimer = null;
        }
        flush();
        sender.send('ai:event', handle.requestId, event);
      }
    }

    // Final flush
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    flush();
  } catch (err) {
    flush();
    if (!sender.isDestroyed()) {
      sender.send('ai:event', handle.requestId, {
        type: 'error',
        code: 'provider_error',
        error: err instanceof Error ? err.message : String(err),
        retryable: false,
      });
    }
  } finally {
    // Remove from active handles
    for (const handles of activeHandles.values()) {
      handles.delete(handle.requestId);
    }
  }
}
```

- [ ] **Step 4: Modify main/index.ts — remove old registerAiHandlers and wire new setup**

In `apps/desktop/src/main/index.ts`:

- Remove the entire `registerAiHandlers()` function (lines 2185-2277)
- At line 2421 where `registerAiHandlers()` is called, replace with:

```typescript
import { createAIService } from './ai/setup';
import { registerAIHandlers } from './ai/ipc-ai';

// In the initialization section (where registerAiHandlers() was called):
const aiService = createAIService();
registerAIHandlers(aiService, () => {
  // Read provider config from settings store (API key stays in main process)
  const settings = settingsStore.getState();
  return {
    apiKey: settings.ai.apiKey,
  };
});
```

Note: Exact import location and settings store access pattern depends on how `settingsStore` is accessible in main process. Adjust during implementation.

- [ ] **Step 5: Verify build**

Run: `cd /Users/tomasmaritano/Documents/Github/readied/readide && pnpm typecheck`
Expected: No errors (may need to fix imports iteratively)

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/main/ai/ apps/desktop/src/main/index.ts apps/desktop/package.json
git commit -m "feat(desktop): wire ai-core IPC bridge with streaming and batching"
```

---

### Task 10: Update preload to expose streaming API

**Files:**

- Modify: `apps/desktop/src/preload/index.ts` — replace `ai.query()` with `ai.chat()`, `ai.onEvent()`, `ai.cancel()`

- [ ] **Step 1: Update preload ai section**

Replace the `ai` section (around line 725-740) in `apps/desktop/src/preload/index.ts`:

```typescript
ai: {
  /** Start a streaming AI chat — returns { requestId } */
  chat: (request: {
    query: string;
    currentNote?: { id: string; title: string; content: string } | null;
    relevantNotes: Array<{ id: string; title: string; content: string }>;
    history: Array<{ role: 'user' | 'assistant'; content: string }>;
    mode: 'chat' | 'ask-notes';
    provider: string;
    model: string;
    maxResponseTokens?: number;
  }) => ipcRenderer.invoke('ai:chat', request) as Promise<{ requestId: string }>,

  /** Listen for streaming AI events */
  onEvent: (cb: (requestId: string, event: unknown) => void) => {
    const handler = (_event: unknown, requestId: string, aiEvent: unknown) => cb(requestId, aiEvent);
    ipcRenderer.on('ai:event', handler);
    return () => { ipcRenderer.removeListener('ai:event', handler); };
  },

  /** Cancel an active AI request */
  cancel: (requestId: string) => ipcRenderer.invoke('ai:cancel', requestId),

  /** Export an AI command preset to a user-chosen file */
  exportPreset: (presetJson: string) =>
    ipcRenderer.invoke('ai:exportPreset', presetJson) as Promise<{ ok: true; filePath: string } | { ok: false; error: string }>,

  /** Import an AI command preset from a user-chosen file */
  importPreset: () =>
    ipcRenderer.invoke('ai:importPreset') as Promise<{ ok: true; content: string } | { ok: false; error: string }>,
},
```

- [ ] **Step 2: Typecheck**

Run: `cd /Users/tomasmaritano/Documents/Github/readied/readide && pnpm typecheck`
Expected: May fail on renderer code that still uses old `ai.query()` — that's expected and fixed in Task 11

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/preload/index.ts
git commit -m "feat(preload): expose streaming AI chat API via IPC"
```

---

## Chunk 6: Renderer Migration

### Task 11: Refactor AiPanel.tsx for streaming

**Files:**

- Modify: `apps/desktop/src/renderer/components/ai/AiPanel.tsx`
- Modify: `apps/desktop/src/renderer/stores/settings/schema.ts`
- Modify: `apps/desktop/src/renderer/pages/settings/sections/AiSection.tsx` — update imports

- [ ] **Step 1: Extend settings schema with provider field**

In `apps/desktop/src/renderer/stores/settings/schema.ts`, update `AiSettings`:

```typescript
/** AI Assistant settings */
export interface AiSettings {
  /** LLM provider id */
  provider: 'anthropic' | 'openai' | 'ollama';
  /** API key (provider-specific) */
  apiKey: string;
  /** Model id */
  model: string;
  /** Maximum number of notes to include as context */
  maxContextNotes: number;
}
```

Update `DEFAULT_AI`:

```typescript
export const DEFAULT_AI: AiSettings = {
  provider: 'anthropic',
  apiKey: '',
  model: 'claude-sonnet-4-20250514',
  maxContextNotes: 5,
};
```

Bump `SETTINGS_VERSION` to 3 and add migration in `settingsStore.ts`.

- [ ] **Step 2: Refactor AiPanel.tsx for event-driven streaming**

Full refactor of `AiPanel.tsx`. Key changes:

- Replace `await window.readied.ai.query(...)` with `window.readied.ai.chat(...)` + `window.readied.ai.onEvent()`
- Accumulate text deltas progressively for live streaming display
- Handle error events by `code` (show user-friendly messages)
- Support cancellation via `window.readied.ai.cancel(requestId)`
- AI commands (summarize, rewrite, tweet) accumulate full response then act

The `handleSubmit` function becomes:

```typescript
const handleSubmit = useCallback(async () => {
  const query = input.trim();
  if (!query || loading) return;

  setInput('');
  setError(null);
  setMessages(prev => [...prev, { role: 'user', content: query }]);
  setLoading(true);

  // Gather context (same as before)
  const currentNote = getCurrentNote();
  const searchResults = await searchNotes(query);
  const relevantNotes = [];
  for (const result of searchResults.slice(0, aiSettings.maxContextNotes)) {
    const note = await getNoteById(result.id);
    if (note) relevantNotes.push(note);
  }

  // Start streaming
  const { requestId } = await window.readied.ai.chat({
    query,
    currentNote,
    relevantNotes,
    history: messages,
    mode,
    provider: aiSettings.provider,
    model: aiSettings.model,
  });

  activeRequestRef.current = requestId;
  let accumulated = '';

  const unsubscribe = window.readied.ai.onEvent((reqId, event) => {
    if (reqId !== requestId) return;
    const e = event as {
      type: string;
      delta?: string;
      code?: string;
      error?: string;
      durationMs?: number;
      cancelled?: boolean;
    };

    switch (e.type) {
      case 'text':
        accumulated += e.delta ?? '';
        setMessages(prev => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (updated[lastIdx]?.role === 'assistant') {
            updated[lastIdx] = { role: 'assistant', content: accumulated };
          } else {
            updated.push({ role: 'assistant', content: accumulated });
          }
          return updated;
        });
        break;
      case 'error':
        if (e.code === 'rate_limit' && e.error?.includes('Retrying')) {
          // Show retry message, don't treat as final error
          setError(e.error);
        } else if (e.code !== 'cancelled') {
          setError(formatErrorMessage(e.code, e.error));
        }
        break;
      case 'done':
        setLoading(false);
        setError(null);
        activeRequestRef.current = null;
        unsubscribe();
        break;
    }
  });
}, [input, loading, messages, aiSettings, mode, getCurrentNote, searchNotes, getNoteById]);
```

Helper for user-friendly error messages:

```typescript
function formatErrorMessage(code?: string, error?: string): string {
  switch (code) {
    case 'rate_limit':
      return 'Rate limited. Please wait a moment and try again.';
    case 'auth_failed':
      return 'Invalid API key. Check your key in Settings > AI Assistant.';
    case 'context_overflow':
      return 'Too much context. Try with fewer notes.';
    case 'model_not_found':
      return 'Model not found. Check your model setting.';
    case 'network':
      return 'Network error. Check your internet connection.';
    case 'timeout':
      return 'Request timed out. Try again.';
    default:
      return error ?? 'An unexpected error occurred.';
  }
}
```

- [ ] **Step 3: Copy aiCommandTypes to ai-core**

Copy `packages/ai-assistant/src/aiCommandTypes.ts` to `packages/ai-core/src/ai-command-types.ts` and `packages/ai-assistant/src/aiCommandTypes.test.ts` to `packages/ai-core/tests/ai-command-types.test.ts`.

Add to `packages/ai-core/src/index.ts`:

```typescript
export type { AiPanelMode } from './context-builder.js'; // re-export for backward compat
// (AiPanelMode is just 'chat' | 'ask-notes' — already the mode field type)

export type {
  AiCommandDefinition,
  AiCommandPreset,
  AiTemplatePlaceholder,
  AiCommandValidationError,
} from './ai-command-types.js';
export {
  AI_TEMPLATE_PLACEHOLDERS,
  resolveTemplate,
  validateAiCommandDefinition,
  validateAiCommandPreset,
  serializePreset,
  parsePreset,
} from './ai-command-types.js';
```

Also add `AiPanelMode` export to `context-builder.ts`:

```typescript
export type AiPanelMode = 'chat' | 'ask-notes';
```

- [ ] **Step 4: Update all renderer imports from @readied/ai-assistant to @readied/ai-core**

Files to update:

- `apps/desktop/src/renderer/pages/settings/sections/AiSection.tsx` — change `@readied/ai-assistant` → `@readied/ai-core`
- `apps/desktop/src/renderer/App.tsx` — change `AiPanelMode`, `NoteContext`, and any other imports from `@readied/ai-assistant` → `@readied/ai-core`
- `apps/desktop/src/renderer/hooks/useRegisterPluginAiCommands.ts` — change `resolveTemplate` import to `@readied/ai-core`
- `apps/desktop/src/renderer/components/ai/AiPanel.tsx` — replace `ClaudeMessage` with `ChatMessage`, remove `buildRagPrompt` import

Run: `grep -r "@readied/ai-assistant" --include="*.ts" --include="*.tsx" apps/ packages/ | grep -v node_modules`
Fix any remaining imports found.

- [ ] **Step 4b: Refactor AiSection.tsx test-connection flow**

The current test-connection uses `window.readied.ai.query()` which no longer exists. Options:

- (a) Add `ai:validate` IPC handler in `ipc-ai.ts` that calls `provider.validate(config)` directly
- (b) Use `ai.chat()` with a test query

Use option (a) — simpler and doesn't consume tokens:

Add to `ipc-ai.ts`:

```typescript
ipcMain.handle('ai:validate', async _event => {
  const config = getProviderConfig();
  const provider = service.registry.get(config.provider ?? 'anthropic');
  return provider.validate(config);
});
```

Add to preload `ai` section:

```typescript
validate: () => ipcRenderer.invoke('ai:validate') as Promise<{ ok: boolean; error?: string }>,
```

Update `AiSection.tsx` `handleTestConnection` to call `window.readied.ai.validate()` instead of `window.readied.ai.query()`.

- [ ] **Step 5: Run full typecheck**

Run: `cd /Users/tomasmaritano/Documents/Github/readied/readide && pnpm typecheck`
Expected: No errors

- [ ] **Step 6: Run tests**

Run: `cd /Users/tomasmaritano/Documents/Github/readied/readide && pnpm test`
Expected: All pass

- [ ] **Step 7: Test manually in dev mode**

Run: `pnpm dev`
Test:

1. Open AI panel (Cmd+Shift+A)
2. Send a message — should stream progressively
3. Try with invalid API key — should show "Invalid API key" not raw JSON
4. Cancel mid-response — should stop cleanly
5. Try AI commands (summarize, rewrite) — should still work

- [ ] **Step 8: Commit**

```bash
git add apps/desktop/src/renderer/ packages/ai-core/src/ai-command-types.ts packages/ai-core/tests/ai-command-types.test.ts packages/ai-core/src/index.ts
git commit -m "feat(desktop): migrate AI panel to streaming with provider abstraction"
```

---

### Task 12: Remove old ai-assistant package

**Files:**

- Delete: `packages/ai-assistant/` (entire directory)
- Verify: no remaining imports from `@readied/ai-assistant`

- [ ] **Step 1: Search for remaining imports**

Run: `grep -r "@readied/ai-assistant" --include="*.ts" --include="*.tsx" apps/ packages/ | grep -v node_modules`
Expected: No results

- [ ] **Step 2: Remove the package**

Run: `rm -rf packages/ai-assistant`

- [ ] **Step 3: Run install to clean workspace**

Run: `cd /Users/tomasmaritano/Documents/Github/readied/readide && pnpm install`

- [ ] **Step 4: Final typecheck + test**

Run: `pnpm typecheck && pnpm test`
Expected: All pass

- [ ] **Step 5: Final manual test**

Run: `pnpm dev`
Verify the AI assistant works end-to-end with streaming.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: remove deprecated @readied/ai-assistant package"
```

---

## Summary

| Chunk | Tasks       | What it delivers                                          |
| ----- | ----------- | --------------------------------------------------------- |
| 1     | Tasks 1-3   | Package scaffold + types + provider interface + registry  |
| 2     | Tasks 4-5   | ContextBuilder (fixes token overflow) + retry (fixes 429) |
| 3     | Tasks 6-7   | SSE parser + AnthropicProvider (streaming)                |
| 4     | Task 8      | AIService orchestrator (ties everything together)         |
| 5     | Tasks 9-10  | Electron IPC bridge with batching + preload API           |
| 6     | Tasks 11-12 | Renderer migration + cleanup                              |

Each chunk produces working, testable code. The old system continues working until Chunk 6 completes the migration.
