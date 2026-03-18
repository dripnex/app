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
