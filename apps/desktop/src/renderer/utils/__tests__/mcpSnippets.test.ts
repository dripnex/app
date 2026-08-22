import { describe, expect, it } from 'vitest';
import {
  FALLBACK_MCP_ENTRY,
  buildClaudeSnippet,
  buildCodexSnippet,
  launchFromConnection,
  shellQuote,
  usesLocalHttp,
} from '../mcpSnippets';

const sqliteLaunch = {
  command: 'npx',
  args: ['-y', 'tsx', '/tmp/mcp/index.ts'],
  dbPath: '/tmp/dripnex.db',
};

const httpLaunch = {
  command: 'npx',
  args: ['-y', 'tsx', '/tmp/mcp/index.ts'],
  dbPath: '/tmp/dripnex.db',
  localServerUrl: 'http://127.0.0.1:29168',
  localToken: 'placeholder-token',
};

describe('mcpSnippets', () => {
  it('quotes only values that need a shell quote', () => {
    expect(shellQuote('/tmp/dripnex.db')).toBe('/tmp/dripnex.db');
    expect(shellQuote('/Users/me/My Notes/dripnex.db')).toBe("'/Users/me/My Notes/dripnex.db'");
    expect(shellQuote('/Users/Tomás/Library/dripnex.db')).toBe("'/Users/Tomás/Library/dripnex.db'");
    expect(shellQuote("it's")).toBe(`'it'\\''s'`);
  });

  it('builds a Claude Code add command for the SQLite fallback', () => {
    expect(buildClaudeSnippet(sqliteLaunch)).toBe(
      'claude mcp add dripnex --env DRIPNEX_DB_PATH=/tmp/dripnex.db -- npx -y tsx /tmp/mcp/index.ts'
    );
  });

  it('builds a Codex config.toml block for the SQLite fallback', () => {
    expect(buildCodexSnippet(sqliteLaunch)).toBe(
      [
        '[mcp_servers.dripnex]',
        'command = "npx"',
        'args = ["-y", "tsx", "/tmp/mcp/index.ts"]',
        'env = { DRIPNEX_DB_PATH = "/tmp/dripnex.db" }',
      ].join('\n')
    );
  });

  it('prefers Local HTTP env when URL and token are set', () => {
    expect(usesLocalHttp(httpLaunch)).toBe(true);
    expect(buildClaudeSnippet(httpLaunch)).toBe(
      'claude mcp add dripnex --env DRIPNEX_LOCAL_SERVER_URL=http://127.0.0.1:29168 --env DRIPNEX_LOCAL_TOKEN=placeholder-token -- npx -y tsx /tmp/mcp/index.ts'
    );
    expect(buildClaudeSnippet(httpLaunch)).not.toContain('DRIPNEX_DB_PATH');
    expect(buildCodexSnippet(httpLaunch)).toBe(
      [
        '[mcp_servers.dripnex]',
        'command = "npx"',
        'args = ["-y", "tsx", "/tmp/mcp/index.ts"]',
        'env = { DRIPNEX_LOCAL_SERVER_URL = "http://127.0.0.1:29168", DRIPNEX_LOCAL_TOKEN = "placeholder-token" }',
      ].join('\n')
    );
    expect(buildCodexSnippet(httpLaunch)).not.toContain('DRIPNEX_DB_PATH');
  });

  it('falls back to a documented path when the app cannot see mcp-server', () => {
    const fallback = launchFromConnection({
      dbPath: '/tmp/dripnex.db',
      mcpCommand: null,
      mcpArgs: null,
    });
    expect(fallback.args.at(-1)).toBe(FALLBACK_MCP_ENTRY);
    expect(usesLocalHttp(fallback)).toBe(false);
    expect(
      launchFromConnection({
        dbPath: '/tmp/dripnex.db',
        mcpCommand: 'node',
        mcpArgs: ['/built/index.js'],
      })
    ).toEqual({
      command: 'node',
      args: ['/built/index.js'],
      dbPath: '/tmp/dripnex.db',
    });
  });

  it('keeps the path placeholder but does not prefer SQLite when HTTP is on', () => {
    const launch = launchFromConnection({
      dbPath: '/tmp/dripnex.db',
      mcpCommand: null,
      mcpArgs: null,
      url: 'http://127.0.0.1:29168',
      token: 'placeholder-token',
      httpEnabled: true,
    });
    expect(launch.args.at(-1)).toBe(FALLBACK_MCP_ENTRY);
    expect(launch.localServerUrl).toBe('http://127.0.0.1:29168');
    expect(launch.localToken).toBe('placeholder-token');
    expect(buildClaudeSnippet(launch)).toContain('DRIPNEX_LOCAL_SERVER_URL=http://127.0.0.1:29168');
    expect(buildClaudeSnippet(launch)).toContain('DRIPNEX_LOCAL_TOKEN=placeholder-token');
    expect(buildClaudeSnippet(launch)).not.toContain('DRIPNEX_DB_PATH');
  });

  it('does not put URL and token in the snippet when HTTP is off', () => {
    const launch = launchFromConnection({
      dbPath: '/tmp/dripnex.db',
      mcpCommand: 'node',
      mcpArgs: ['/built/index.js'],
      url: 'http://127.0.0.1:29168',
      token: 'placeholder-token',
      httpEnabled: false,
    });
    expect(usesLocalHttp(launch)).toBe(false);
    expect(launch.localServerUrl).toBeUndefined();
    expect(buildClaudeSnippet(launch)).toContain('DRIPNEX_DB_PATH=/tmp/dripnex.db');
    expect(buildClaudeSnippet(launch)).not.toContain('DRIPNEX_LOCAL_TOKEN');
  });
});
