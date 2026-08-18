/**
 * Sync Core Types Tests
 */

import { describe, it, expect } from 'vitest';
import {
  EncryptedNotePushRequestSchema,
  LocalNotePushSchema,
  NotePullResponseSchema,
  NotePushResultSchema,
} from '../src/types';

describe('LocalNotePushSchema', () => {
  it('accepts a plaintext note push', () => {
    const result = LocalNotePushSchema.safeParse({
      noteId: 'note_456',
      operation: 'update',
      content: '# Hello',
      localVersion: 2,
    });
    expect(result.success).toBe(true);
  });

  it('rejects an empty note id', () => {
    const result = LocalNotePushSchema.safeParse({
      noteId: '',
      operation: 'create',
    });
    expect(result.success).toBe(false);
  });
});

describe('EncryptedNotePushRequestSchema', () => {
  it('accepts a ciphertext batch', () => {
    const result = EncryptedNotePushRequestSchema.safeParse({
      deviceId: '11111111-1111-4111-8111-111111111111',
      changes: [{ noteId: 'n1', operation: 'create', encryptedData: 'enc' }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects a missing device id', () => {
    const result = EncryptedNotePushRequestSchema.safeParse({
      changes: [{ noteId: 'n1', operation: 'create' }],
    });
    expect(result.success).toBe(false);
  });
});

describe('NotePushResultSchema', () => {
  it('validates a push result', () => {
    const result = NotePushResultSchema.safeParse({
      noteId: 'n1',
      version: 3,
      status: 'applied',
    });
    expect(result.success).toBe(true);
  });
});

describe('NotePullResponseSchema', () => {
  it('validates a pull payload', () => {
    const result = NotePullResponseSchema.safeParse({
      changes: [
        {
          id: 'c1',
          noteId: 'n1',
          version: 1,
          operation: 'create',
          encryptedData: 'enc',
          deviceId: 'd1',
          createdAt: '2026-08-18T00:00:00Z',
        },
      ],
      cursor: 1,
      hasMore: false,
    });
    expect(result.success).toBe(true);
  });
});
