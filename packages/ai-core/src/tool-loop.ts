// packages/ai-core/src/tool-loop.ts
import type { LLMEvent, ChatOptions, ChatMessage, ContentPart } from './types.js';
import type { LLMProvider, ProviderConfig } from './provider.js';
import type { ToolResult } from './tool-registry.js';
import { withRetry, type RetryOptions } from './retry.js';

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
  retry?: Partial<RetryOptions>;
}

// ─── Implementation ─────────────────────────────────────────

export async function* runToolLoop(options: ToolLoopOptions): AsyncIterable<ToolLoopEvent> {
  const { provider, providerConfig, chatOptions, maxRoundTrips, signal, executeTool, retry } =
    options;

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

    for await (const event of withRetry(
      () => provider.chat(currentOptions, providerConfig),
      retry ?? { maxRetries: 3 }
    )) {
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
