import { describe, expect, it } from 'vitest';
import { namespaceToolName, mapMcpCallResult } from '../mcpClientManager';

describe('namespaceToolName', () => {
  it('prefixes with mcp_ and the server id', () => {
    expect(namespaceToolName('linear', 'search_issues')).toBe('mcp_linear_search_issues');
  });

  it('sanitizes non alphanumeric characters in both server id and tool name', () => {
    expect(namespaceToolName('my server!', 'do/thing:now')).toBe('mcp_my_server__do_thing_now');
  });
});

describe('mapMcpCallResult', () => {
  it('joins text blocks into content and reports ok', () => {
    expect(
      mapMcpCallResult({
        content: [
          { type: 'text', text: 'first' },
          { type: 'text', text: 'second' },
        ],
      })
    ).toEqual({ ok: true, content: 'first\nsecond' });
  });

  it('marks non-text blocks as omitted instead of dropping them silently', () => {
    expect(mapMcpCallResult({ content: [{ type: 'image' }] })).toEqual({
      ok: true,
      content: '[image omitted]',
    });
  });

  it('reports isError as a failed ToolResult with the content as the error message', () => {
    expect(mapMcpCallResult({ content: [{ type: 'text', text: 'boom' }], isError: true })).toEqual({
      ok: false,
      content: 'boom',
      error: 'boom',
    });
  });

  it('falls back to a placeholder when there is no content at all', () => {
    expect(mapMcpCallResult({})).toEqual({ ok: true, content: '(empty result)' });
  });
});
