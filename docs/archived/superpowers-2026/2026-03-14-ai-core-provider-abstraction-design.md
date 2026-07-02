# AI Core — Provider Abstraction & Streaming Architecture

**Date:** 2026-03-14
**Status:** Approved
**Scope:** Refactor AI Assistant from hardcoded Claude client to provider-agnostic, streaming-first architecture

---

## Problem Statement

The current AI Assistant has critical issues:

1. **Hardcoded to Anthropic Claude** — `claude-client.ts` only talks to `api.anthropic.com`
2. **No streaming** — uses `await response.json()`, responses arrive all at once or get cut off
3. **No rate limit handling** — 429 errors shown as raw JSON to the user
4. **No token budgeting** — sends all notes as context without measuring token usage
5. **Fixed maxTokens (2048)** — long responses get truncated
6. **API key management** — keys are passed through IPC per-request; should be resolved in main process from settings store

## Goals

- Provider-agnostic architecture supporting Anthropic, OpenAI, Ollama (and future providers)
- Real streaming via IPC with backpressure-aware batching
- Automatic retry with exponential backoff + jitter for rate limits
- Token budgeting to prevent context overflow
- Clean cancellation and resource cleanup
- API keys never leave main process — resolved from settings store, not sent by renderer
- Foundation for future tools, agents, and memory — without requiring architectural changes

## Non-Goals (Future Phases)

- OpenAI and Ollama provider implementations (Phase 2)
- Tool registry and execution (Phase 3)
- Memory layer (Phase 3)
- Model routing (Phase 2)
- TanStack AI integration in renderer (Phase 2)
- Intent detection (Phase 3)
- Multimodal content (images) — types are prepared but Phase 1 only uses text

---

## Architecture Overview

```
Renderer
  |
  +-- ipcRenderer.invoke('ai:chat', request)
  |     -> returns { requestId }
  |     -> request does NOT contain API keys (resolved in main)
  |
  +-- ipcRenderer.on('ai:event', (requestId, event) => { ... })
  |     -> receives batched LLMEvents
  |
  +-- ipcRenderer.invoke('ai:cancel', requestId)
        -> aborts specific stream


Main Process

  ipc-ai.ts (bridge only, no logic)
  |
  +-- ipcMain.handle('ai:chat')
  |     -> reads API key + provider config from settings store
  |     -> creates AIService.chat(request)
  |     -> starts consuming events (lazy: iteration starts here)
  |     -> sends batched events to renderer
  |
  +-- ipcMain.handle('ai:cancel')
  |     -> calls handle.abort()
  |
  +-- ipcMain.handle('ai:exportPreset') -> kept from current impl
  +-- ipcMain.handle('ai:importPreset') -> kept from current impl
  |
  +-- webContents.on('destroyed')
        -> calls service.cancelAll()


  AIService (orchestration)
  |
  +-- 1. Generate requestId (crypto.randomUUID)
  +-- 2. Resolve provider via ProviderRegistry
  +-- 3. Build context via ContextBuilder
  +-- 4. Emit { type: 'start' } event (AIService owns this, not provider)
  +-- 5. Call provider.chat() with retry wrapper
  +-- 6. Forward provider events (text, usage, error, tool_call)
  +-- 7. Emit { type: 'done', durationMs } event (AIService owns this, not provider)
  +-- 8. On tool_call: execute tool -> re-call provider (future)


  ContextBuilder (stateless pure function)
  |
  +-- Receives: system prompt + note + history + RAG notes
  +-- Estimates tokens per source
  +-- Applies priority-based trimming
  +-- Returns: { system, messages, tokenEstimate }


  ProviderRegistry
  |
  +-- providers: Map<string, LLMProvider>
  +-- register(provider)
  +-- get(id): LLMProvider


  LLMProvider (e.g. AnthropicProvider)
  |
  +-- Receives fetchFn via constructor (dependency injection)
  +-- Translates ChatOptions -> provider-specific API call
  +-- Parses SSE stream -> LLMEvent (text, usage, error, tool_call only)
  +-- Does NOT emit 'start' or 'done' (AIService's responsibility)
  +-- Handles provider-specific error codes -> LLMErrorCode
```

---

## Package Structure

```
packages/ai-core/
  src/
    index.ts                 # re-exports
    types.ts                 # LLMEvent, ChatMessage, ContentPart, LLMErrorCode
    provider.ts              # LLMProvider, ProviderConfig, ModelInfo, FetchFn
    provider-registry.ts     # ProviderRegistry
    context-builder.ts       # buildContext (stateless)
    retry.ts                 # withRetry, classifyError
    ai-service.ts            # AIServiceImpl
    providers/
      anthropic.ts           # AnthropicProvider (Phase 1)

apps/desktop/
  src/main/ai/
    ipc-ai.ts                # IPC bridge + batching + cleanup + preset handlers
    setup.ts                 # registry setup, provider registration, fetch injection
```

---

## Type Definitions

### Event Protocol

```typescript
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
```

**Event ownership clarification:**

- `start` and `done` are emitted by **AIService only** (not by providers)
- `text`, `usage`, `tool_call`, `error` are emitted by **providers**
- `tool_result` is emitted by **AIService** after executing a tool (future)
- `requestId` appears only in `start`; correlation is via the `ChatHandle` or IPC `requestId` argument

### Chat Types

```typescript
export type ContentPart = { type: 'text'; text: string } | { type: 'image'; url: string };

// string for the 95% case, ContentPart[] when multimodal (future)
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
  maxTokens: number; // required — AIService sets this from ChatRequest.maxResponseTokens
  signal?: AbortSignal;
  tools?: ToolDefinition[];
}
```

**`maxTokens` is required in `ChatOptions`** — the AIService is responsible for setting it (default: 4096). This eliminates ambiguity about who owns the default.

### Fetch Function Injection

```typescript
/**
 * Minimal fetch signature for portability.
 * In Electron main process: pass `net.fetch` for proxy/cert support.
 * In tests: pass a mock.
 * In Node.js: pass global `fetch`.
 */
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
```

**Why injection:** `packages/ai-core` is pure TS with no Electron deps. Electron's `net.fetch` respects system proxy and certs. The existing `claude-client.ts` already uses this pattern. The provider receives `fetchFn` via constructor, and `setup.ts` injects `net.fetch` when creating the provider instance.

### Provider Interface

```typescript
export interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  options?: Record<string, unknown>;
}

export interface ModelInfo {
  id: string;
  displayName: string;
  contextWindow: number;
  maxOutputTokens: number;
  supportsStreaming: boolean;
  supportsTools: boolean;
}

export interface LLMProvider {
  readonly id: string;
  readonly displayName: string;

  /**
   * Stream chat completions. Emits: text, usage, tool_call, error events.
   * Does NOT emit 'start' or 'done' — those are AIService's responsibility.
   */
  chat(options: ChatOptions, config: ProviderConfig): AsyncIterable<LLMEvent>;
  validate(config: ProviderConfig): Promise<{ ok: boolean; error?: string }>;
  listModels(config: ProviderConfig): Promise<ModelInfo[]>;
}
```

### AIService Interface

```typescript
export interface NoteContext {
  id: string;
  title: string;
  content: string;
}

/**
 * Request from renderer. Does NOT contain API keys.
 * ipc-ai.ts resolves provider config from settings store before calling AIService.
 */
export interface ChatRequest {
  query: string;
  currentNote?: NoteContext | null;
  relevantNotes: NoteContext[];
  history: ChatMessage[];
  mode: 'chat' | 'ask-notes';
  provider: string;
  model: string;
  providerConfig: ProviderConfig; // resolved by ipc-ai.ts, not renderer
  maxResponseTokens?: number; // default: 4096
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
```

**Lazy consumption:** The `AsyncIterable` returned in `ChatHandle.events` is an async generator. The provider stream does NOT start until the consumer begins iterating (`for await...of`). This means `ipc-ai.ts` controls when the stream starts by beginning iteration, and no tokens are buffered if the consumer is delayed.

### ContextBuilder Interface

```typescript
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

export function buildContext(sources: ContextSources, budget: ContextBudget): ContextBuildResult;
```

---

## Component Responsibilities

### AIService

**Owns:**

- requestId lifecycle (create, track, cleanup)
- Active request registry (`Map<requestId, AbortController>`)
- Retry orchestration (delegates to `withRetry`)
- `start` and `done` event emission (providers don't emit these)
- Timing measurement (`durationMs` in 'done' event)
- `maxTokens` default (4096) when not specified in request
- Provider selection (via ProviderRegistry)
- Context building delegation (calls ContextBuilder)

**Does not own:**

- API communication (provider's job)
- Token estimation (ContextBuilder's job)
- IPC serialization (ipc-ai.ts's job)
- UI state (renderer's job)
- API key resolution (ipc-ai.ts reads from settings store)

### ContextBuilder

**Owns:**

- Token estimation (handles both `string` and `ContentPart[]` content)
- Priority-based trimming
- System prompt assembly
- Note truncation

**Does not own:**

- Note retrieval (caller's job)
- Search/RAG (caller's job)
- API calls (provider's job)

**Invariant:** Pure function, zero side effects, callable N times per request (required for tool loops).

**Token estimation for MessageContent:**

```typescript
function estimateMessageTokens(content: MessageContent): number {
  if (typeof content === 'string') return estimateTokens(content);
  // For ContentPart[], estimate text parts; images use a fixed estimate
  return content.reduce((sum, part) => {
    if (part.type === 'text') return sum + estimateTokens(part.text);
    if (part.type === 'image') return sum + 1000; // conservative fixed estimate
    return sum;
  }, 0);
}
```

**Trimming priority:**

1. System prompt — always included (~200 tokens, controlled by us)
2. Current note — high priority, truncate if exceeds 40% of remaining budget
3. Conversation history — newest turns first, drop oldest on overflow. **Individual messages are dropped entirely, not truncated mid-message**, to avoid incoherent partial responses in history.
4. Relevant notes — fill remaining budget

### ProviderRegistry

**Owns:**

- Provider registration and lookup by id

**Does not own:**

- Provider configuration (caller passes config per-request)
- Model selection (AIService's job)

### LLMProvider (e.g. AnthropicProvider)

**Owns:**

- API communication with specific provider
- SSE stream parsing
- Event normalization (provider events -> `text`, `usage`, `tool_call`, `error` events)
- Provider-specific error classification

**Does not own:**

- `start`/`done` event emission (AIService's responsibility)
- Retry logic (AIService wraps with withRetry)
- Context trimming (ContextBuilder's job)
- Request lifecycle (AIService's job)
- fetch implementation (injected via constructor)

---

## AnthropicProvider — Event Normalization

The Anthropic API emits internal SSE events. The provider normalizes them to `LLMEvent`:

```
Anthropic SSE event        ->    LLMEvent
-----------------------------------------------------------
message_start              ->    (not emitted — AIService emits 'start')
content_block_delta        ->    { type: 'text', delta }
input_json_delta           ->    (accumulate internally for tool_call)
content_block_stop (tool)  ->    { type: 'tool_call', id, name, args }
message_delta              ->    { type: 'usage', inputTokens, outputTokens }
message_stop               ->    (not emitted — AIService emits 'done')
error                      ->    { type: 'error', code, error, retryable }
```

**Provider constructor:**

```typescript
class AnthropicProvider implements LLMProvider {
  constructor(private fetchFn: FetchFn) {}
  // ...
}
```

**`setup.ts` injects Electron's `net.fetch`:**

```typescript
import { net } from 'electron';
const anthropic = new AnthropicProvider(net.fetch);
registry.register(anthropic);
```

**Implementation decision:** Fetch-based (no SDK dependency). Anthropic's SSE is standard `text/event-stream`. This keeps the package pure TS with zero external dependencies, gives full control over retry/timeout/abort, and avoids the ~200KB SDK bundle.

**Static model list with live fallback:** `listModels` returns a hardcoded list (works offline). If a live API call succeeds, it supplements the list. The static list is updated with each Dripnex release.

---

## Retry Logic

```typescript
interface RetryOptions {
  maxRetries: number; // default: 3
  baseDelay: number; // default: 1000ms
  maxDelay: number; // default: 30000ms
  jitter: boolean; // default: true
  retryableCodes: LLMErrorCode[]; // default: ['rate_limit', 'network', 'provider_error']
}
```

**Behavior:**

- On retryable error, waits with exponential backoff + jitter
- Reads `retry-after` header from Anthropic 429 responses when available
- Emits intermediate error events so the renderer can show "Retrying in Ns..."
- After all retries exhausted, emits final non-retryable error
- Status 529 (Anthropic overloaded) treated as retryable
- On `context_overflow`: AIService can optionally re-call ContextBuilder with tighter budget and retry once (not exponential)

**Jitter formula:** `delay = exponential * (0.5 + random * 0.5)` — prevents thundering herd.

**Error classification:**

- 429 -> `rate_limit`
- 401 -> `auth_failed`
- 400 with "context" or "too long" -> `context_overflow`
- 404 -> `model_not_found`
- 500/502/503/529 -> `provider_error`
- Network/fetch errors -> `network`
- AbortError -> `cancelled`

---

## IPC Streaming with Batching

### Problem

At high token throughput (Haiku: 100+ tokens/sec), each token as a separate `webContents.send()` saturates the IPC bridge.

### Solution

Buffer text deltas in main process, flush every 50ms:

- `text` events: accumulate in buffer, flush on timer
- All other events (`start`, `done`, `error`, `usage`, `tool_call`): flush buffer immediately, then send event immediately
- On `sender.isDestroyed()`: abort stream, stop sending

**50ms interval rationale:** At 100 tok/s, batches ~5 tokens per flush = ~20 IPC calls/sec instead of ~100. Imperceptible latency, 5x less IPC overhead.

### IPC Channel Design

```
Renderer -> Main:
  'ai:chat'    (invoke)  -> returns { requestId }
  'ai:cancel'  (invoke)  -> cancels specific request

Main -> Renderer:
  'ai:event'   (send)    -> (requestId, LLMEvent)
```

`requestId` is a separate IPC argument (not inside the event payload) so the renderer can route events to the correct conversation without parsing the event body.

### API Key Flow

```
Renderer sends ChatRequest (no API key)
  -> ipc-ai.ts reads settings store for provider + apiKey
  -> ipc-ai.ts constructs ProviderConfig { apiKey, baseUrl }
  -> ipc-ai.ts passes full ChatRequest (with providerConfig) to AIService
```

The renderer NEVER sees or sends API keys. `ipc-ai.ts` resolves them from the Electron main process settings store.

---

## Cancellation & Cleanup

### User cancels via UI

1. Renderer calls `ipcRenderer.invoke('ai:cancel', requestId)`
2. Main process finds the `ChatHandle` and calls `handle.abort()`
3. `AbortController.abort()` cancels the fetch
4. `AIService` emits `{ type: 'done', cancelled: true, durationMs }`
5. Main process removes handle from active registry

### Window destroyed

1. `webContents.on('destroyed')` fires
2. All active handles for that window are aborted
3. All handles removed from registry

### Stream abandoned (renderer navigates away)

Same as window destroyed — handled by the `sender.isDestroyed()` check in the batching loop.

### Inter-chunk timeout

If no event arrives from the provider for 30 seconds, the stream is considered stale. AIService aborts and emits `{ type: 'error', code: 'timeout' }` followed by `{ type: 'done', cancelled: true }`.

### Incomplete message handling

When a stream is cancelled mid-response, the last assistant message in history is incomplete. The ContextBuilder handles this by **dropping the incomplete message entirely** from the next request's history. The renderer marks it visually as cancelled but does not send it back.

---

## Token Estimation

```typescript
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function estimateMessageTokens(content: MessageContent): number {
  if (typeof content === 'string') return estimateTokens(content);
  return content.reduce((sum, part) => {
    if (part.type === 'text') return sum + estimateTokens(part.text);
    if (part.type === 'image') return sum + 1000;
    return sum;
  }, 0);
}
```

**Rationale:** ~4 chars/token is the standard heuristic for English/Spanish. For budgeting purposes (not billing), +/-15% error is acceptable. The goal is "don't exceed context window", not "use exactly 99.8% of budget".

**Future option:** `@anthropic-ai/tokenizer` for exact counting, but it adds ~2MB and latency. Not needed for Phase 1.

---

## Migration Path

### What gets replaced

| Current                                          | New                                                         |
| ------------------------------------------------ | ----------------------------------------------------------- |
| `packages/ai-assistant/src/claude-client.ts`     | `packages/ai-core/src/providers/anthropic.ts`               |
| `packages/ai-assistant/src/rag.ts`               | `packages/ai-core/src/context-builder.ts`                   |
| `packages/ai-assistant/src/prompts.ts`           | Moves into `context-builder.ts` (system prompts)            |
| `apps/desktop/src/main/index.ts` AI IPC handlers | `apps/desktop/src/main/ai/ipc-ai.ts` + `setup.ts`           |
| `window.dripnex.ai.query()` (single response)    | `ai:chat` invoke + `ai:event` listener (streaming)          |
| `AiPanel.tsx` handleSubmit (await response)      | Event-driven: accumulate text deltas, handle errors by code |

### What gets moved

| Current                       | New                                  | Notes                                 |
| ----------------------------- | ------------------------------------ | ------------------------------------- |
| `ai:exportPreset` IPC handler | `apps/desktop/src/main/ai/ipc-ai.ts` | Moved alongside other AI IPC handlers |
| `ai:importPreset` IPC handler | `apps/desktop/src/main/ai/ipc-ai.ts` | Moved alongside other AI IPC handlers |

### What stays

| Component                                            | Status                               |
| ---------------------------------------------------- | ------------------------------------ |
| `packages/ai-assistant/src/prompts.ts` (prompt text) | Content reused in context-builder.ts |
| `packages/ai-assistant/src/aiCommandTypes.ts`        | Kept as-is                           |
| `AiPanel.tsx` (UI structure)                         | Adapted for streaming, same layout   |
| `AiMessage.tsx`                                      | Kept as-is                           |
| Settings store (`ai.apiKey`, `ai.model`)             | Extended with `ai.provider`          |

### AI Commands Migration

The existing AI command system (`AiInitialCommand` in `AiPanel.tsx`) uses `window.dripnex.ai.query()` synchronously to get a full response before doing `replaceSelection()` or `insertAtCursor()`.

**Phase 1 approach:** AI commands use the same streaming protocol but **accumulate the full response** before executing the output action:

```typescript
// In AiPanel.tsx — AI command execution
const chunks: string[] = [];
for await (const event of streamEvents(requestId)) {
  if (event.type === 'text') chunks.push(event.delta);
  if (event.type === 'done') break;
}
const fullResponse = chunks.join('');
if (command.outputTarget === 'replace') replaceSelection(fullResponse);
```

This is streaming-compatible (benefits from retry, error codes, cancellation) while preserving the "accumulate then act" behavior that replace/insert requires.

### Deprecation

`packages/ai-assistant` is replaced by `packages/ai-core`. The old package is removed once migration is complete.

---

## Future Extensions (No Architectural Changes Required)

### Phase 2: Multi-Provider + Model Router

- Add `OpenAIProvider` and `OllamaProvider` to `providers/`
- Each receives `fetchFn` via constructor (same pattern)
- Register in `setup.ts`
- Add provider selector to Settings UI
- Simple model router in AIService (task type -> model)

### Phase 2: TanStack AI in Renderer

- Optional: use `@tanstack/react-ai` for chat state management
- Consumes `ai:event` IPC events
- Replaces manual state management in `AiPanel.tsx`

### Phase 3: Tool System

- Add `ToolRegistry` to AIService
- `tools` field already in `ChatOptions`
- `tool_call` and `tool_result` events already in protocol
- Agent loop composes on top of `AIService.chat()`
- ContextBuilder already accepts `toolResults` in `ContextSources`

### Phase 3: Memory

- Add `memories?: MemoryEntry[]` to `ContextSources`
- ContextBuilder already has priority-based trimming
- Memory retrieval is another context source, not a new system

---

## Decision Log

| Decision                                          | Rationale                                                     |
| ------------------------------------------------- | ------------------------------------------------------------- |
| Fetch injection (`FetchFn`)                       | Pure TS package + Electron `net.fetch` support + testability  |
| Fetch-based, no Anthropic SDK                     | Zero deps, full control, ~150 lines vs ~200KB SDK             |
| `AsyncIterable<LLMEvent>`                         | Natural backpressure, composable, cancelable                  |
| Lazy stream consumption                           | No buffering until consumer iterates; prevents resource waste |
| Event-based protocol (not string stream)          | Future-proof for tools, reasoning, citations                  |
| `start`/`done` owned by AIService                 | Provider doesn't know requestId or timing; clean separation   |
| `metadata` on all events                          | Extensibility without breaking types                          |
| `LLMErrorCode` typed enum                         | UI can show context-appropriate messages per error type       |
| `MessageContent = string \| ContentPart[]`        | Ergonomic for common case, ready for multimodal               |
| `maxTokens` required in `ChatOptions`             | Eliminates ambiguity; AIService always sets it                |
| Token estimation via `length/4`                   | Good enough for budgeting, no heavy tokenizer dep             |
| History messages dropped whole, not truncated     | Avoids incoherent partial messages in context                 |
| 50ms IPC batching                                 | 5x less IPC overhead, imperceptible latency                   |
| `requestId` as first-class concept                | Prevents race conditions, enables concurrent chats            |
| `requestId` only on `start` event                 | ChatHandle provides correlation; no redundancy                |
| API keys resolved in main process                 | Renderer never sees keys; settings store is source of truth   |
| `system` in `ChatOptions` (set by ContextBuilder) | Clean separation: builder decides prompt, provider sends it   |
| Jitter in retry backoff                           | Prevents thundering herd on rate limits                       |
| Static model list + live fallback                 | Works offline (Dripnex philosophy), updates when online       |
| 30s inter-chunk timeout                           | Prevents stale streams from hanging indefinitely              |
