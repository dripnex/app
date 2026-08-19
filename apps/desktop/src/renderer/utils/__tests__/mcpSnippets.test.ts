import { describe, expect, it } from 'vitest';
import {
  FALLBACK_MCP_ENTRY,
  buildClaudeSnippet,
  buildCodexSnippet,
  launchFromConnection,
  shellQuote,
} from '../mcpSnippets';

const launch = {
  command: 'npx',
  args: ['-y', 'tsx', '/tmp/mcp/index.ts'],
  dbPath: '/tmp/dripnex.db',
};

describe('mcpSnippets', () => {
  it('quotes only values that need a shell quote', () => {
    expect(shellQuote('/tmp/dripnex.db')).toBe('/tmp/dripnex.db');
    expect(shellQuote('/Users/me/My Notes/dripnex.db')).toBe("'/Users/me/My Notes/dripnex.db'");
    expect(shellQuote('/Users/Tomás/Library/dripnex.db')).toBe("'/Users/Tomás/Library/dripnex.db'");
    expect(shellQuote("it's")).toBe(`'it'\\''s'`);
  });

  it('builds a Claude Code add command', () => {
    expect(buildClaudeSnippet(launch)).toBe(
      'claude mcp add dripnex --env DRIPNEX_DB_PATH=/tmp/dripnex.db -- npx -y tsx /tmp/mcp/index.ts'
    );
  });

  it('builds a Codex config.toml block', () => {
    expect(buildCodexSnippet(launch)).toBe(
      [
        '[mcp_servers.dripnex]',
        'command = "npx"',
        'args = ["-y", "tsx", "/tmp/mcp/index.ts"]',
        'env = { DRIPNEX_DB_PATH = "/tmp/dripnex.db" }',
      ].join('\n')
    );
  });

  it('falls back to a documented path when the app cannot see mcp-server', () => {
    const fallback = launchFromConnection({
      dbPath: '/tmp/dripnex.db',
      mcpCommand: null,
      mcpArgs: null,
    });
    expect(fallback.args.at(-1)).toBe(FALLBACK_MCP_ENTRY);
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
});
