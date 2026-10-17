import { describe, expect, it, vi } from 'vitest';
import { ToolRegistry } from '@dripnex/ai-core';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

interface MockTool {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

class MockClient {
  onerror?: (error: Error) => void;
  onclose?: () => void;
  closed = false;
  readonly connectGate = deferred<void>();
  readonly listToolsGate = deferred<{ tools: MockTool[] }>();

  connect(): Promise<void> {
    return this.connectGate.promise;
  }
  listTools(): Promise<{ tools: MockTool[] }> {
    return this.listToolsGate.promise;
  }
  callTool(): Promise<{ content: never[] }> {
    return Promise.resolve({ content: [] });
  }
  close(): Promise<void> {
    this.closed = true;
    this.onclose?.();
    return Promise.resolve();
  }
}

const instances: MockClient[] = [];

vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: class {
    constructor() {
      const instance = new MockClient();
      instances.push(instance);
      return instance;
    }
  },
}));

vi.mock('@modelcontextprotocol/sdk/client/stdio.js', () => ({
  StdioClientTransport: class {},
  getDefaultEnvironment: () => ({}),
}));

vi.mock('node:child_process', () => ({
  execFile: (_cmd: string, _args: string[], _opts: unknown, callback: (error: Error) => void) =>
    callback(new Error('no shell in test environment')),
}));

const { namespaceToolName, mapMcpCallResult, McpClientManager } =
  await import('../mcpClientManager');

function config(id: string) {
  return { id, name: id, command: 'npx', args: ['server'], enabled: true };
}

/** Lets every already-queued microtask (the chain of awaits inside connect()
 * up to its first genuinely pending promise) run, without resolving anything
 * ourselves. setImmediate only fires once the microtask queue is empty. */
function flushMicrotasks(): Promise<void> {
  return new Promise(resolve => setImmediate(resolve));
}

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

describe('McpClientManager concurrency', () => {
  it('disconnect() during a pending connect closes the in-flight client instead of leaving it orphaned', async () => {
    const manager = new McpClientManager();
    const registry = new ToolRegistry();

    const connectPromise = manager.connect(config('srv'), registry);
    await flushMicrotasks();
    expect(manager.getState('srv').status).toBe('connecting');
    const client = instances.at(-1)!;

    await manager.disconnect('srv');
    expect(client.closed).toBe(true);
    expect(manager.getState('srv').status).toBe('disconnected');

    // The in-flight connect() eventually finishes its SDK calls - it must not
    // resurrect a connection, or register tools, nobody wants anymore.
    client.connectGate.resolve();
    client.listToolsGate.resolve({ tools: [{ name: 'search', inputSchema: {} }] });
    await connectPromise;

    expect(manager.getState('srv').status).toBe('disconnected');
    expect(registry.has('mcp_srv_search')).toBe(false);
    expect(manager.isConnected('srv')).toBe(false);
  });

  it('a newer connect() for the same id cancels a slower in-flight one instead of racing it', async () => {
    const manager = new McpClientManager();
    const registry = new ToolRegistry();

    const firstConnect = manager.connect(config('srv'), registry);
    await flushMicrotasks();
    const firstClient = instances.at(-1)!;

    const secondConnect = manager.connect(config('srv'), registry);
    await flushMicrotasks();
    const secondClient = instances.at(-1)!;

    expect(secondClient).not.toBe(firstClient);
    expect(firstClient.closed).toBe(true);

    // The cancelled first attempt still finishes its SDK calls eventually -
    // it must not clobber the second connection's state or tools.
    firstClient.connectGate.resolve();
    firstClient.listToolsGate.resolve({ tools: [{ name: 'stale_tool', inputSchema: {} }] });
    await firstConnect;

    secondClient.connectGate.resolve();
    secondClient.listToolsGate.resolve({ tools: [{ name: 'fresh_tool', inputSchema: {} }] });
    await secondConnect;

    const state = manager.getState('srv');
    expect(state).toMatchObject({ status: 'connected', toolCount: 1 });
    expect(registry.has('mcp_srv_stale_tool')).toBe(false);
    expect(registry.has('mcp_srv_fresh_tool')).toBe(true);
  });

  it('closes the client if connect() succeeds but listTools() fails, instead of leaking the process', async () => {
    const manager = new McpClientManager();
    const registry = new ToolRegistry();

    const connectPromise = manager.connect(config('srv'), registry);
    await flushMicrotasks();
    const client = instances.at(-1)!;

    client.connectGate.resolve();
    // Flush so the manager actually calls listTools() (attaching a handler to
    // listToolsGate.promise) before we reject it - rejecting first would
    // reject a promise nothing has subscribed to yet.
    await flushMicrotasks();
    client.listToolsGate.reject(new Error('server has no tools capability'));
    const state = await connectPromise;

    expect(state).toMatchObject({ status: 'error', error: 'server has no tools capability' });
    expect(client.closed).toBe(true);
    expect(manager.isConnected('srv')).toBe(false);
  });
});
