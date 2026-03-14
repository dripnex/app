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
