export interface McpLaunch {
  command: string;
  args: string[];
  dbPath: string;
  localServerUrl?: string;
  localToken?: string;
}

export function shellQuote(value: string): string {
  if (value.length === 0) return "''";
  if (/^[\w./:@%+=,-]+$/.test(value)) return value;
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function usesLocalHttp(launch: McpLaunch): boolean {
  return Boolean(launch.localServerUrl && launch.localToken);
}

function envPairs(launch: McpLaunch): Array<[string, string]> {
  if (launch.localServerUrl && launch.localToken) {
    return [
      ['DRIPNEX_LOCAL_SERVER_URL', launch.localServerUrl],
      ['DRIPNEX_LOCAL_TOKEN', launch.localToken],
    ];
  }
  return [['DRIPNEX_DB_PATH', launch.dbPath]];
}

export function buildClaudeSnippet(launch: McpLaunch): string {
  const env = envPairs(launch)
    .map(([key, value]) => `--env ${key}=${shellQuote(value)}`)
    .join(' ');
  const command = [launch.command, ...launch.args].map(shellQuote).join(' ');
  return `claude mcp add dripnex ${env} -- ${command}`;
}

export function buildCodexSnippet(launch: McpLaunch): string {
  const args = launch.args.map(value => JSON.stringify(value)).join(', ');
  const env = envPairs(launch)
    .map(([key, value]) => `${key} = ${JSON.stringify(value)}`)
    .join(', ');
  return [
    '[mcp_servers.dripnex]',
    `command = ${JSON.stringify(launch.command)}`,
    `args = [${args}]`,
    `env = { ${env} }`,
  ].join('\n');
}

export const FALLBACK_MCP_ENTRY = '/ABS/PATH/dripnex/packages/mcp-server/src/index.ts';

export function launchFromConnection(info: {
  dbPath: string;
  mcpCommand: string | null;
  mcpArgs: string[] | null;
  url?: string;
  token?: string;
  httpEnabled?: boolean;
}): McpLaunch {
  const base: McpLaunch =
    info.mcpCommand && info.mcpArgs
      ? { command: info.mcpCommand, args: info.mcpArgs, dbPath: info.dbPath }
      : { command: 'npx', args: ['-y', 'tsx', FALLBACK_MCP_ENTRY], dbPath: info.dbPath };

  if (info.httpEnabled && info.url && info.token) {
    base.localServerUrl = info.url;
    base.localToken = info.token;
  }
  return base;
}
