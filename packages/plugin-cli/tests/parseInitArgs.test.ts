import { describe, it, expect } from 'vitest';
import { parseInitArgs } from '../src/parseInitArgs';

describe('parseInitArgs', () => {
  it('defaults to plugin', () => {
    expect(parseInitArgs(['Paper'])).toEqual({ name: 'Paper', type: 'plugin' });
  });

  it('reads --type theme', () => {
    expect(parseInitArgs(['Paper', '--type', 'theme'])).toEqual({ name: 'Paper', type: 'theme' });
  });

  it('rejects an unknown --type', () => {
    expect(() => parseInitArgs(['Paper', '--type', 'unsupported'])).toThrow(
      '--type must be plugin or theme'
    );
  });

  it('rejects a missing --type value', () => {
    expect(() => parseInitArgs(['Paper', '--type'])).toThrow('--type must be plugin or theme');
  });
});
