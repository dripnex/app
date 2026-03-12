// packages/plugin-api/tests/dataTypes.test.ts
import { describe, it, expect } from 'vitest';
import { DataAccessError } from '../src/data/dataTypes';

describe('DataAccessError', () => {
  it('sets name to DataAccessError', () => {
    const err = new DataAccessError('getNotes', 'IPC failed');
    expect(err.name).toBe('DataAccessError');
  });

  it('includes method in message', () => {
    const err = new DataAccessError('getNotes', 'IPC failed');
    expect(err.message).toBe('[DataAPI.getNotes] IPC failed');
  });

  it('exposes method property', () => {
    const err = new DataAccessError('getGraphData', 'timeout');
    expect(err.method).toBe('getGraphData');
  });

  it('is an instance of Error', () => {
    const err = new DataAccessError('getTags', 'oops');
    expect(err).toBeInstanceOf(Error);
  });
});
