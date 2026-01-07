/**
 * Sync Core Types Tests
 */

import { describe, it, expect } from 'vitest';
import { SyncChangeSchema, PushResultSchema, PullResultSchema } from '../src/types';

describe('SyncChangeSchema', () => {
  it('validates valid sync change', () => {
    const validChange = {
      id: 'sc_123',
      entityType: 'note',
      entityId: 'note_456',
      operation: 'update',
      data: { title: 'Test' },
      timestamp: '2024-01-07T00:00:00Z',
      synced: false,
      retryCount: 0,
      lastError: null,
    };

    const result = SyncChangeSchema.safeParse(validChange);
    expect(result.success).toBe(true);
  });

  it('rejects invalid entity type', () => {
    const invalid = {
      id: 'sc_123',
      entityType: 'invalid',
      entityId: 'note_456',
      operation: 'update',
      data: {},
      timestamp: '2024-01-07T00:00:00Z',
      synced: false,
      retryCount: 0,
      lastError: null,
    };

    const result = SyncChangeSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe('PushResultSchema', () => {
  it('validates push result', () => {
    const result = PushResultSchema.safeParse({
      synced: ['id1', 'id2'],
      conflicts: [],
      errors: [],
    });
    expect(result.success).toBe(true);
  });
});

describe('PullResultSchema', () => {
  it('validates pull result', () => {
    const result = PullResultSchema.safeParse({
      updated: ['id1'],
      cursor: 'abc123',
      hasMore: false,
    });
    expect(result.success).toBe(true);
  });
});
