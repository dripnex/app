/**
 * MCP Client Config Storage
 *
 * Securely stores the external MCP servers Dripnex's own agent is allowed
 * to connect to (stdio command + args + optional env). A server's env can
 * carry secrets (a Slack/Linear token, say), so this follows the same
 * safeStorage-encrypted-JSON-file shape as AiKeyStorage rather than a plain
 * settings file.
 *
 * Error handling mirrors AiKeyStorage: ENOENT on read -> empty map; an
 * encryption/decryption failure throws instead of silently dropping
 * configured servers.
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { safeStorage } from 'electron';

export interface McpServerConfig {
  id: string;
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  /** Whether this server should be connected to automatically on startup. */
  enabled: boolean;
}

type ConfigMap = Record<string, McpServerConfig>;

export class McpClientConfigEncryptionUnavailableError extends Error {
  constructor() {
    super(
      'Encryption is not available on this system. ' +
        'On Linux, ensure libsecret (gnome-keyring / kwallet) is running.'
    );
    this.name = 'McpClientConfigEncryptionUnavailableError';
  }
}

export class McpClientConfigDecryptionError extends Error {
  readonly cause: unknown;
  constructor(cause: unknown) {
    super(
      'Failed to decrypt MCP server configs. The OS keychain may be locked or the ' +
        'encrypted file may be corrupt. The stored file was left in place.'
    );
    this.name = 'McpClientConfigDecryptionError';
    this.cause = cause;
  }
}

export class McpClientConfigStorage {
  private readonly filePath: string;

  /**
   * @param dataDir - User data directory path (e.g. `app.getPath('userData')`)
   */
  constructor(dataDir: string) {
    this.filePath = join(dataDir, 'mcp-client-servers.encrypted');
  }

  async list(): Promise<McpServerConfig[]> {
    const configs = await this.readConfigs();
    return Object.values(configs);
  }

  async get(id: string): Promise<McpServerConfig | null> {
    const configs = await this.readConfigs();
    return configs[id] ?? null;
  }

  async save(config: McpServerConfig): Promise<void> {
    const configs = await this.readConfigs();
    configs[config.id] = config;
    await this.writeConfigs(configs);
  }

  async remove(id: string): Promise<void> {
    const configs = await this.readConfigs();
    delete configs[id];

    if (Object.keys(configs).length === 0) {
      await this.unlinkFile();
      return;
    }

    await this.writeConfigs(configs);
  }

  private async readConfigs(): Promise<ConfigMap> {
    let encrypted: Buffer;
    try {
      encrypted = await fs.readFile(this.filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return {};
      }
      throw error;
    }

    if (!safeStorage.isEncryptionAvailable()) {
      throw new McpClientConfigEncryptionUnavailableError();
    }

    let plaintext: string;
    try {
      plaintext = safeStorage.decryptString(encrypted);
    } catch (cause) {
      throw new McpClientConfigDecryptionError(cause);
    }

    let configs: unknown;
    try {
      configs = JSON.parse(plaintext);
    } catch (cause) {
      throw new McpClientConfigDecryptionError(cause);
    }

    if (typeof configs !== 'object' || configs === null || Array.isArray(configs)) {
      throw new McpClientConfigDecryptionError(new Error('Decrypted payload is not a JSON object'));
    }

    // We trust the shape because we wrote it; the IPC handler boundary
    // validates configs before they're written.
    return configs as ConfigMap;
  }

  private async writeConfigs(configs: ConfigMap): Promise<void> {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new McpClientConfigEncryptionUnavailableError();
    }

    const plaintext = JSON.stringify(configs);
    const encrypted = safeStorage.encryptString(plaintext);
    await fs.writeFile(this.filePath, encrypted);
  }

  private async unlinkFile(): Promise<void> {
    try {
      await fs.unlink(this.filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }
}
