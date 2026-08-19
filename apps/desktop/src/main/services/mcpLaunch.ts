import { existsSync } from 'fs';
import { join } from 'path';
import { app } from 'electron';

export interface McpLaunchSpec {
  command: string;
  args: string[];
}

/**
 * Find a runnable @dripnex/mcp-server entry on this machine.
 * Packaged builds typically return null — the UI then shows a fallback path.
 */
export function resolveMcpLaunch(): McpLaunchSpec | null {
  const roots = [app.getAppPath(), process.cwd()];
  const distRels = [
    'packages/mcp-server/dist/index.js',
    '../packages/mcp-server/dist/index.js',
    '../../packages/mcp-server/dist/index.js',
    '../../../packages/mcp-server/dist/index.js',
  ];
  const srcRels = distRels.map(rel => rel.replace('dist/index.js', 'src/index.ts'));

  for (const root of roots) {
    for (const rel of distRels) {
      const candidate = join(root, rel);
      if (existsSync(candidate)) return { command: 'node', args: [candidate] };
    }
  }
  for (const root of roots) {
    for (const rel of srcRels) {
      const candidate = join(root, rel);
      if (existsSync(candidate)) return { command: 'npx', args: ['-y', 'tsx', candidate] };
    }
  }
  return null;
}
