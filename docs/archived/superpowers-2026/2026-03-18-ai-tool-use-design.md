# AI Tool Use — Design Spec

**Date:** 2026-03-18
**Branch:** `feature/ai-tool-use`
**Status:** Approved

## Overview

Add tool use (function calling) to the AI assistant, allowing the model to search notes, read content, and perform editor actions during a conversation. Built on the existing `ai-core` provider abstraction.

## Goals

- Model can call tools during conversation to gather information and take actions
- Read tools (search, read, list) execute automatically
- Write tools (insert, replace, create) require user confirmation
- Extensible registry so plugins can register custom tools
- Max 5 round-trips per turn to prevent infinite loops

## Non-Goals

- Plugin-defined tools (registry supports it, but no plugin API exposed yet)
- Tool use in pre-filled commands (ai:summarize, ai:rewrite, ai:tweet)
- Streaming tool call arguments (accumulate full args before executing)

## Architecture

### Layer 1: Type Extensions (`packages/ai-core/src/types.ts`)

Extend the existing types to support tool use in conversation history:

```typescript
// New ContentPart variants for tool use
export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image'; url: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };

// Extend LLMEvent with stop reason
export type LLMEvent =
  | /* ...existing variants... */
  | { type: 'stop'; reason: 'end_turn' | 'tool_use' | 'max_tokens' };

// Add tools to ChatRequest
export interface ChatRequest {
  /* ...existing fields... */
  tools?: ToolDefinition[];
}
```

**Why tool_use/tool_result as ContentPart:** The Anthropic API expects tool results as content blocks within a `role: "user"` message, and the assistant's tool calls as content blocks within `role: "assistant"`. By making them `ContentPart` variants, the conversation history naturally represents the full exchange using `MessageContent = string | ContentPart[]`. No new roles needed.

**Why `stop` event:** The tool loop needs to know whether the model stopped because it wants tool results (`tool_use`) or because it's done (`end_turn`). The existing `done` event is owned by AIService and fires regardless. The `stop` event is emitted by the provider and carries the model's stop reason.

### Layer 2: Tool Registry (`packages/ai-core/src/tool-registry.ts`)

```typescript
// Reuses existing ToolDefinition from types.ts
import type { ToolDefinition } from './types.js';

interface ToolRegistration extends ToolDefinition {
  execute: (args: Record<string, unknown>) => Promise<ToolResult>;
  requiresConfirmation: boolean;
}

interface ToolResult {
  ok: boolean;
  content: string; // stringified result for the model
  error?: string;
}

class ToolRegistry {
  register(tool: ToolRegistration): () => void; // returns unregister fn
  get(name: string): ToolRegistration | undefined;
  getDefinitions(): ToolDefinition[]; // for sending to model
  has(name: string): boolean;
}
```

Pure TypeScript, no framework dependencies. Same pattern as `aiCommandStore`.

### Layer 3: Anthropic Provider — Tool Use Parsing

The Anthropic API returns tool use as SSE events:

1. `content_block_start` with `type: "tool_use"` — contains `id`, `name`
2. `content_block_delta` with `type: "input_json_delta"` — partial JSON args
3. `content_block_stop` — signals end of block, parse accumulated JSON

The provider accumulates JSON deltas and emits a single `LLMEvent` of type `tool_call`:

```typescript
{ type: 'tool_call', id: string, name: string, args: Record<string, unknown> }
```

Additionally, the provider emits a `stop` event from `message_delta` when it sees `stop_reason`:

```typescript
// In message_delta handler:
if (delta.stop_reason) {
  yield { type: 'stop', reason: delta.stop_reason };
}
```

**Anthropic message format for tool results (handled in provider's `normalizeMessages`):**

```typescript
// Assistant message with tool_use content blocks (preserved in history):
{ role: 'assistant', content: [
  { type: 'text', text: 'Let me search for that.' },
  { type: 'tool_use', id: 'call_123', name: 'search_notes', input: { query: 'react' } }
]}

// User message with tool_result content blocks:
{ role: 'user', content: [
  { type: 'tool_result', tool_use_id: 'call_123', content: '[{"id":"1","title":"React Notes"}]' }
]}
```

The provider maps `ContentPart` variants to/from the Anthropic API format.

### Layer 4: Tool Loop (`packages/ai-core/src/tool-loop.ts`)

**Key design decision:** The tool loop calls `provider.chat()` directly for subsequent round-trips, NOT `AIService.chat()`. This avoids:

- Duplicate `start`/`done` lifecycle events per round-trip
- Multiple `requestId`s (one per AIService.chat() call) breaking cancel tracking
- Redundant context building on each iteration

The tool loop manages its own `AbortController` and emits lifecycle events once.

```typescript
interface ToolLoopOptions {
  provider: LLMProvider;
  providerConfig: ProviderConfig;
  chatOptions: ChatOptions;         // initial request with tools + messages
  maxRoundTrips: number;            // default: 5
  signal: AbortSignal;              // for cancellation
  executeTool: (call: ToolCall) => Promise<ToolResult>;
}

interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

type ToolLoopEvent =
  | LLMEvent                                    // pass-through from provider
  | { type: 'tool_executing'; call: ToolCall }
  | { type: 'tool_complete'; call: ToolCall; result: ToolResult }
  | { type: 'round_trip'; current: number; max: number }
  | { type: 'max_round_trips_reached' };

async function* runToolLoop(options: ToolLoopOptions): AsyncIterable<ToolLoopEvent>;
```

Flow:

1. Call `provider.chat(chatOptions, config)` with tools
2. Stream events, accumulate `tool_call` events and text
3. On `stop` event with `reason: 'tool_use'`:
   a. For each tool_call, invoke `executeTool` callback
   b. Append assistant message (with tool_use content blocks) to messages
   c. Append user message (with tool_result content blocks) to messages
   d. Increment round_trip, emit `round_trip` event
   e. Call `provider.chat()` again with updated messages
4. On `stop` event with `reason: 'end_turn'` → yield remaining events, done
5. If round_trip >= maxRoundTrips → emit `max_round_trips_reached`, stop
6. If `signal.aborted` at any point → break immediately

**Batch execution with mixed confirmation:**

- Auto-execute tools (requiresConfirmation=false) run immediately in parallel
- Confirmation-required tools are presented to the user sequentially
- ALL tool results (auto + confirmed) must be collected before re-sending to model
- If a tool is rejected by user, send `is_error: true` result: "Tool execution cancelled by user"

**Individual tool failures:** If a tool throws, send `{ is_error: true, content: error.message }` as the tool result. The model receives the error and can decide how to proceed. Other tools in the batch continue normally.

### Layer 5: IPC Integration

The tool loop runs in main process. AIService is extended minimally:

**New method on AIServiceImpl: `chatWithTools()`**

```typescript
interface ToolChatRequest extends ChatRequest {
  tools: ToolDefinition[];
  maxRoundTrips?: number;
  executeTool: (call: ToolCall) => Promise<ToolResult>;
}

chatWithTools(request: ToolChatRequest): ChatHandle {
  // Creates requestId + AbortController like chat()
  // But internally uses runToolLoop instead of executeChat
  // Emits start/done lifecycle events wrapping the entire loop
}
```

This keeps the existing `chat()` unchanged (backward compatible) and adds tool support as a separate code path.

**Modified IPC handler: `ai:chat`**

- Accepts optional `tools` in the request
- When tools are present, calls `service.chatWithTools()` with an `executeTool` callback that:
  - Checks `toolRegistry.get(name).requiresConfirmation`
  - `false` → execute directly, return result
  - `true` → emit `tool_call` event to renderer, wait for `ai:tool-confirm` (with 60s timeout)

**New IPC handler: `ai:tool-confirm`**

```typescript
ipcMain.handle('ai:tool-confirm', (event, requestId: string, callId: string, approved: boolean) => void)
```

Resolves a pending confirmation promise. Timeout after 60s auto-rejects.

**New IPC events for renderer-executed tools:**

```typescript
// Main → Renderer: request tool execution in renderer
sender.send('ai:tool-execute-in-renderer', requestId, callId, toolName, args)

// Renderer → Main: tool execution result
ipcMain.handle('ai:tool-renderer-result', (event, requestId, callId, result: ToolResult) => void)
```

**New preload methods:**

```typescript
ai: {
  // existing: chat, onEvent, cancel, validate, exportPreset, importPreset
  confirmTool(requestId: string, callId: string, approved: boolean): Promise<void>;
  onToolExecuteRequest(cb: (requestId: string, callId: string, toolName: string, args: unknown) => void): () => void;
  sendToolResult(requestId: string, callId: string, result: { ok: boolean; content: string; error?: string }): Promise<void>;
}
```

### Layer 6: UI (`apps/desktop/src/renderer/components/ai/`)

**AiPanel.tsx changes:**

- Pass `tools: true` flag in chat request (main process resolves tool definitions from registry)
- Handle new event types: `tool_executing`, `tool_complete`, `tool_call` (for confirmation)
- Track pending confirmations in state: `Map<callId, ToolCall>`
- Listen for `ai:tool-execute-in-renderer` to run editor tools locally
- Messages now include tool call/result blocks interleaved with text

**New component: `ToolCallBlock.tsx`**
Renders a tool call inline in the message stream:

- Header: tool icon + name
- Body: formatted args (collapsed by default)
- States:
  - `pending_confirmation` → "Run search_notes?" + Approve/Reject buttons
  - `executing` → spinner
  - `complete` → result preview (collapsed, expandible)
  - `rejected` → "Cancelled by user"
  - `error` → error message

**AiMessage.tsx changes:**

- Detect tool call blocks in assistant messages
- Render `ToolCallBlock` inline between text segments

### Layer 7: Built-in Tools

Registered in main process at startup (`apps/desktop/src/main/ai/built-in-tools.ts`):

#### Read Tools (requiresConfirmation: false)

**search_notes**

- params: `{ query: string, limit?: number }`
- Searches notes using existing FTS, returns `[{ id, title, snippet }]`

**read_note**

- params: `{ id: string }`
- Returns full note content `{ id, title, content }`

**list_notebooks**

- params: `{}`
- Returns `[{ id, name, noteCount }]`

#### Write Tools (requiresConfirmation: true)

**insert_text**

- params: `{ text: string, position?: 'cursor' | 'end' }`
- Inserts text at cursor or end of current note
- **Executed in renderer** via `ai:tool-execute-in-renderer` IPC

**replace_selection**

- params: `{ text: string }`
- Replaces current editor selection
- **Executed in renderer** via `ai:tool-execute-in-renderer` IPC

**create_note**

- params: `{ title: string, content: string, notebookId?: string }`
- Creates a new note in the specified notebook (or default)
- Executed in main process

## Data Flow

```
User types message
  ↓
AiPanel → window.readied.ai.chat({ ..., tools: true })
  ↓
IPC 'ai:chat' → service.chatWithTools(request)
  ↓
chatWithTools emits 'start' event (once)
  ↓
runToolLoop() → provider.chat() streams events
  ↓
Provider emits: text, text, tool_call, tool_call, stop(tool_use)
  ↓
Tool loop collects tool_calls, invokes executeTool callback
  ↓
For each tool_call:
  ├─ requiresConfirmation=false → execute immediately
  │   └─ emit tool_executing → execute → emit tool_complete
  └─ requiresConfirmation=true → emit tool_call to renderer, wait
      ├─ user clicks Approve → IPC 'ai:tool-confirm' → execute
      └─ user clicks Reject → send is_error result to model
  ↓
ALL results collected → append to messages → provider.chat() again
  ↓
Provider emits: text, text, stop(end_turn)
  ↓
chatWithTools emits 'done' event (once)
```

## Limits

| Limit                   | Value        | Rationale                           |
| ----------------------- | ------------ | ----------------------------------- |
| Max round-trips         | 5            | Covers search→read→act patterns     |
| Max parallel tool calls | 3            | Anthropic can return multiple       |
| Tool execution timeout  | 30s          | Prevent hung tools                  |
| Confirmation timeout    | 60s          | Auto-reject if user doesn't respond |
| Max tool result size    | 10,000 chars | Avoid blowing context window        |

## Error Handling

- **Individual tool failure:** Send `{ is_error: true, content: errorMessage }` as tool_result. Model receives the error and decides next action.
- **User rejects tool:** Send `{ is_error: true, content: "Tool execution cancelled by user" }`.
- **Confirmation timeout (60s):** Auto-reject with `{ is_error: true, content: "Tool confirmation timed out" }`.
- **Max round-trips reached:** Emit `max_round_trips_reached` event, stop loop. Last accumulated text is shown to user.
- **Cancellation (user hits cancel):** AbortSignal propagates through tool loop → provider → all pending operations. Clean up immediately.

## Settings

No new user-facing settings. Tool use is enabled implicitly when the AI panel is open. Limits are internal constants.

Future: could add toggle in AI settings to enable/disable tool use.

## Testing Strategy

- **Unit tests** in `packages/ai-core/tests/`:
  - `tool-registry.test.ts` — register, unregister, get, getDefinitions
  - `tool-loop.test.ts` — mock provider, verify round-trip logic, max trips, cancellation, mixed confirmation, individual failures
  - `anthropic-tool-parsing.test.ts` — SSE events for tool_use content blocks, stop reason parsing
- **Integration**: manual testing in dev mode with real Anthropic API

## Migration

No schema migration needed. The tool use is additive — `ai:chat` still works without tools (backward compatible). The `ContentPart` type extension is additive (existing text/image variants unchanged).

## File Changes Summary

| File                                                        | Change                                                                                      |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `packages/ai-core/src/types.ts`                             | **Modify** — add tool_use/tool_result ContentPart, stop LLMEvent, tools on ChatRequest      |
| `packages/ai-core/src/tool-registry.ts`                     | **New** — ToolRegistry class                                                                |
| `packages/ai-core/src/tool-loop.ts`                         | **New** — runToolLoop async generator                                                       |
| `packages/ai-core/src/providers/anthropic.ts`               | **Modify** — parse tool_use SSE events, emit stop event, normalizeMessages for tool content |
| `packages/ai-core/src/ai-service.ts`                        | **Modify** — add chatWithTools() method                                                     |
| `packages/ai-core/src/index.ts`                             | **Modify** — export new modules                                                             |
| `apps/desktop/src/main/ai/built-in-tools.ts`                | **New** — register built-in tools                                                           |
| `apps/desktop/src/main/ai/ipc-ai.ts`                        | **Modify** — tool loop integration, confirm handler, renderer-executed tools                |
| `apps/desktop/src/main/ai/setup.ts`                         | **Modify** — initialize ToolRegistry + built-in tools                                       |
| `apps/desktop/src/preload/index.ts`                         | **Modify** — add confirmTool, onToolExecuteRequest, sendToolResult                          |
| `apps/desktop/src/renderer/components/ai/AiPanel.tsx`       | **Modify** — tool events, confirmation state, renderer tool execution                       |
| `apps/desktop/src/renderer/components/ai/ToolCallBlock.tsx` | **New** — tool call UI component                                                            |
| `apps/desktop/src/renderer/components/ai/AiMessage.tsx`     | **Modify** — render tool blocks                                                             |
| `packages/ai-core/tests/tool-registry.test.ts`              | **New**                                                                                     |
| `packages/ai-core/tests/tool-loop.test.ts`                  | **New**                                                                                     |
| `packages/ai-core/tests/anthropic-tool-parsing.test.ts`     | **New**                                                                                     |
