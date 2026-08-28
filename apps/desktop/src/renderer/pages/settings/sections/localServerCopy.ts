/** Empty / error copy for MCP and Local HTTP. Explain what is missing. */

export const LOCAL_SERVER_BRIDGE_STALE =
  'This window opened before the local server bridge loaded. Quit Dripnex completely and open it again — Settings does not pick up preload changes on refresh.';

export const MCP_STARTING = 'Starting the local server. Snippets appear when it is up.';
export const MCP_DID_NOT_START = 'The local MCP server did not start.';
export const MCP_LOAD_ERROR = 'Could not load MCP connection.';

export const HTTP_STARTING = 'Starting the loopback API. URL and token appear when it is up.';
export const HTTP_DID_NOT_START = 'The loopback API did not start.';
export const HTTP_LOAD_ERROR = 'Could not load local HTTP status.';

export const COPY_FAILED = 'Could not copy.';

export const LOCAL_SERVER_START_POLL_MS = 750;
export const LOCAL_SERVER_MAX_START_POLLS = 20;

export type LocalServerBodyState = 'stale' | 'off' | 'starting' | 'running' | 'error';

/** False when the start-poll window already timed out; a late refresh must not clear the error. */
export function shouldApplyStartPollResult(timedOut: boolean): boolean {
  return !timedOut;
}

export function localServerBodyState(args: {
  ready: boolean;
  enabled: boolean;
  running: boolean;
  error: string | null;
}): LocalServerBodyState {
  if (!args.ready) return 'stale';
  if (!args.enabled) return 'off';
  if (args.running) return 'running';
  if (args.error) return 'error';
  return 'starting';
}
