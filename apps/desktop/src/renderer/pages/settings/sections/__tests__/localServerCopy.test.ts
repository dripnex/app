import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  COPY_FAILED,
  HTTP_DID_NOT_START,
  HTTP_STARTING,
  LOCAL_SERVER_BRIDGE_STALE,
  MCP_DID_NOT_START,
  MCP_STARTING,
  localServerBodyState,
  shouldApplyStartPollResult,
} from '../localServerCopy';

const here = dirname(fileURLToPath(import.meta.url));
const mcpSrc = readFileSync(join(here, '../McpCard.tsx'), 'utf8');
const httpSrc = readFileSync(join(here, '../LocalHttpCard.tsx'), 'utf8');

describe('localServerBodyState', () => {
  it('names stale, off, starting, running, and error', () => {
    expect(localServerBodyState({ ready: false, enabled: true, running: false, error: null })).toBe(
      'stale'
    );
    expect(localServerBodyState({ ready: true, enabled: false, running: false, error: null })).toBe(
      'off'
    );
    expect(localServerBodyState({ ready: true, enabled: true, running: false, error: null })).toBe(
      'starting'
    );
    expect(localServerBodyState({ ready: true, enabled: true, running: true, error: null })).toBe(
      'running'
    );
    expect(
      localServerBodyState({
        ready: true,
        enabled: true,
        running: false,
        error: MCP_DID_NOT_START,
      })
    ).toBe('error');
  });

  it('keeps a running server in running even if a later error is set', () => {
    expect(
      localServerBodyState({
        ready: true,
        enabled: true,
        running: true,
        error: 'token rotated',
      })
    ).toBe('running');
  });
});

describe('MCP / Local HTTP copy', () => {
  it('explains what is missing without cheering', () => {
    expect(MCP_STARTING.toLowerCase()).toContain('starting');
    expect(HTTP_STARTING.toLowerCase()).toContain('starting');
    expect(MCP_DID_NOT_START.toLowerCase()).not.toMatch(/oops|sorry|failed to launch/i);
    expect(HTTP_DID_NOT_START.toLowerCase()).toContain('did not start');
    expect(COPY_FAILED).toBe('Could not copy.');
    expect(LOCAL_SERVER_BRIDGE_STALE).toMatch(/Quit Dripnex/);
  });

  it('ignores a late refresh after the start poll timed out, including the initial request', () => {
    expect(shouldApplyStartPollResult(true)).toBe(false);
    expect(shouldApplyStartPollResult(false)).toBe(true);
    expect(httpSrc).toContain('timedOutRef');
    expect(mcpSrc).toContain('timedOutRef');
    expect(httpSrc).toContain('void refresh({ ignore: () => timedOutRef.current })');
    expect(mcpSrc).toContain('void refresh({ ignore: () => timedOutRef.current })');
    expect(httpSrc.match(/ignore: \(\) => timedOutRef\.current/g)?.length).toBeGreaterThanOrEqual(
      2
    );
    expect(mcpSrc.match(/ignore: \(\) => timedOutRef\.current/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it('wires empty and error states in both cards', () => {
    expect(mcpSrc).toContain('localServerBodyState');
    expect(mcpSrc).toContain('MCP_STARTING');
    expect(mcpSrc).toContain('toast.error(COPY_FAILED)');
    expect(mcpSrc).toContain("bodyState === 'running'");
    expect(httpSrc).toContain('localServerBodyState');
    expect(httpSrc).toContain('HTTP_STARTING');
    expect(httpSrc).toContain('HTTP_DID_NOT_START');
    expect(httpSrc).toContain('toast.error(COPY_FAILED)');
    expect(httpSrc).toContain("bodyState === 'running'");
  });
});
