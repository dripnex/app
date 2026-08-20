import { describe, expect, it, vi } from 'vitest';
import { createLogger } from '../src/index.js';

describe('createLogger', () => {
  it('prefixes messages with the namespace', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const log = createLogger('stamp');
    log.info('ready', 1);
    expect(info).toHaveBeenCalledWith('[stamp]', 'ready', 1);
    info.mockRestore();
  });
});
