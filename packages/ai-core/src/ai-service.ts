// packages/ai-core/src/ai-service.ts
import type { LLMEvent, ChatOptions, ChatMessage, ToolDefinition } from './types.js';
import type { ProviderConfig } from './provider.js';
import { ProviderRegistry } from './provider-registry.js';
import { buildContext, SYSTEM_PROMPT, ASK_NOTES_SYSTEM_PROMPT } from './context-builder.js';
import type { NoteContext } from './context-builder.js';
import { withRetry } from './retry.js';
import type { ToolResult } from './tool-registry.js';
import type { ToolCall, ToolLoopEvent } from './tool-loop.js';
import { runToolLoop } from './tool-loop.js';

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

export interface ToolChatRequest extends ChatRequest {
  tools: ToolDefinition[];
  maxRoundTrips?: number;
  executeTool: (call: ToolCall) => Promise<ToolResult>;
}

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

  cancelAll(): void {
    for (const controller of this.activeRequests.values()) {
      controller.abort();
    }
    this.activeRequests.clear();
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
