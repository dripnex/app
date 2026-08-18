import { z } from 'zod';
import { defineIpcHandler } from '../ipc/registry.js';
import type { InferredEdge } from './inferred-graph.js';

const embedProviderSchema = z.enum(['ollama', 'openai']);

export function registerKbHandlers(deps: {
  status: () => Promise<{
    pending: number;
    embedded: number;
    model: string;
    provider: string;
    dim: number;
  }>;
  reindex: () => void;
  setEmbed: (input: {
    provider: 'ollama' | 'openai';
    model: string;
    baseUrl?: string;
  }) => Promise<{ provider: string; model: string; dim: number }>;
  catalog: () => Promise<
    Array<{
      id: string;
      displayName: string;
      models: Array<{ id: string; displayName: string; dimensions: number }>;
    }>
  >;
  inferredGraph?: () => Promise<InferredEdge[]>;
}): void {
  defineIpcHandler({
    channel: 'kb:status',
    args: z.tuple([]),
    handler: () => deps.status(),
  });

  defineIpcHandler({
    channel: 'kb:reindex',
    args: z.tuple([]),
    handler: () => {
      deps.reindex();
    },
  });

  defineIpcHandler({
    channel: 'kb:setEmbed',
    args: z.tuple([
      z.object({
        provider: embedProviderSchema,
        model: z.string().min(1),
        baseUrl: z.string().optional(),
      }),
    ]),
    handler: input => deps.setEmbed(input),
  });

  defineIpcHandler({
    channel: 'kb:catalog',
    args: z.tuple([]),
    handler: () => deps.catalog(),
  });

  defineIpcHandler({
    channel: 'kb:inferredGraph',
    args: z.tuple([]),
    handler: async () => (deps.inferredGraph ? deps.inferredGraph() : []),
  });
}
