import { rename, writeFile } from 'fs/promises';
import { join } from 'path';

export const MCP_WRITES_FILE = 'mcp.json';

export async function writeMcpWritesConfig(dataRoot: string, writes: boolean): Promise<void> {
  const dest = join(dataRoot, MCP_WRITES_FILE);
  const tmp = `${dest}.${process.pid}.tmp`;
  await writeFile(tmp, `${JSON.stringify({ writes }, null, 2)}\n`, {
    encoding: 'utf-8',
    mode: 0o600,
  });
  await rename(tmp, dest);
}
