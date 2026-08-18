import type { ChunkRepository } from '@dripnex/storage-core';

export const DEFAULT_EMBED_MODEL = 'nomic-embed-text';
export const DEFAULT_EMBED_DIM = 768;
export const DEFAULT_EMBED_PROVIDER = 'ollama';

export interface EmbedDrainLog {
  info: (fields: Record<string, unknown>, message: string) => void;
  warn: (fields: Record<string, unknown>, message: string) => void;
}

/**
 * Embed pending chunks. Never logs passage text (PHI).
 * Stops the drain if the provider is unreachable so we retry later.
 */
export async function drainPendingEmbeddings(
  chunks: Pick<ChunkRepository, 'listPending' | 'updateEmbedding'>,
  embed: (texts: string[]) => Promise<number[][]>,
  meta: { model: string; dim: number },
  options?: { batchSize?: number; maxBatches?: number; log?: EmbedDrainLog }
): Promise<{ scanned: number; embedded: number; failed: boolean }> {
  const batchSize = options?.batchSize ?? 16;
  const maxBatches = options?.maxBatches ?? 8;
  let scanned = 0;
  let embedded = 0;

  for (let batch = 0; batch < maxBatches; batch++) {
    const pending = await chunks.listPending(batchSize);
    if (pending.length === 0) break;
    scanned += pending.length;
    let vectors: number[][];
    try {
      vectors = await embed(pending.map(chunk => chunk.content));
    } catch {
      options?.log?.warn({ scanned, embedded }, 'kb embed provider unreachable');
      return { scanned, embedded, failed: true };
    }
    if (vectors.length !== pending.length) {
      options?.log?.warn({ scanned, embedded }, 'kb embed batch size mismatch');
      return { scanned, embedded, failed: true };
    }
    for (let i = 0; i < pending.length; i++) {
      const vector = vectors[i]!;
      if (vector.length !== meta.dim) continue;
      await chunks.updateEmbedding(pending[i]!.id, vector, meta);
      embedded += 1;
    }
  }

  if (embedded > 0) {
    options?.log?.info({ scanned, embedded }, 'kb embed drain');
  }
  return { scanned, embedded, failed: false };
}

export function createEmbeddingIndexer(deps: {
  chunks: Pick<ChunkRepository, 'listPending' | 'updateEmbedding'>;
  embed: (texts: string[]) => Promise<number[][]>;
  getMeta: () => { model: string; dim: number };
  log?: EmbedDrainLog;
  debounceMs?: number;
}): { schedule: () => void; drain: () => Promise<void>; stop: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running = false;
  let queued = false;

  const drain = async () => {
    if (running) {
      queued = true;
      return;
    }
    running = true;
    try {
      await drainPendingEmbeddings(deps.chunks, deps.embed, deps.getMeta(), { log: deps.log });
    } finally {
      running = false;
      if (queued) {
        queued = false;
        void drain();
      }
    }
  };

  return {
    schedule() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        void drain();
      }, deps.debounceMs ?? 400);
    },
    drain,
    stop() {
      if (timer) clearTimeout(timer);
      timer = null;
      queued = false;
    },
  };
}
