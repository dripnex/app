export interface McpLaunch {
  command: string;
  args: string[];
  dbPath: string;
}

export function shellQuote(value: string): string {
  if (value.length === 0) return "''";
  if (/^[\w./:@%+=,-]+$/.test(value)) return value;
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function buildClaudeSnippet(launch: McpLaunch): string {
  const env = `--env DRIPNEX_DB_PATH=${shellQuote(launch.dbPath)}`;
  const command = [launch.command, ...launch.args].map(shellQuote).join(' ');
  return `claude mcp add dripnex ${env} -- ${command}`;
}

export function buildCodexSnippet(launch: McpLaunch): string {
  const args = launch.args.map(value => JSON.stringify(value)).join(', ');
  return [
    '[mcp_servers.dripnex]',
    `command = ${JSON.stringify(launch.command)}`,
    `args = [${args}]`,
    `env = { DRIPNEX_DB_PATH = ${JSON.stringify(launch.dbPath)} }`,
  ].join('\n');
}

export const FALLBACK_MCP_ENTRY = '/ABS/PATH/dripnex/packages/mcp-server/src/index.ts';

export function launchFromConnection(info: {
  dbPath: string;
  mcpCommand: string | null;
  mcpArgs: string[] | null;
}): McpLaunch {
  if (info.mcpCommand && info.mcpArgs) {
    return { command: info.mcpCommand, args: info.mcpArgs, dbPath: info.dbPath };
  }
  return { command: 'npx', args: ['-y', 'tsx', FALLBACK_MCP_ENTRY], dbPath: info.dbPath };
}
