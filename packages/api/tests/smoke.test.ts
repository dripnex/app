import { describe, it, expect } from 'vitest';
import app from '../src/index.js';

describe('API smoke test', () => {
  it('health check returns ok', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });
});
