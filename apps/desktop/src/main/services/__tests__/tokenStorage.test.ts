import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, stat, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { rmSync } from 'fs';

const isEncryptionAvailable = vi.fn();
const encryptString = vi.fn();
const decryptString = vi.fn();

vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: () => isEncryptionAvailable(),
    encryptString: (value: string) => encryptString(value),
    decryptString: (value: Buffer) => decryptString(value),
  },
}));

import { TokenStorage } from '../tokenStorage.js';

const TOKENS = { accessToken: 'access-1', refreshToken: 'refresh-1' };

describe('TokenStorage', () => {
  let dir: string;
  let storage: TokenStorage;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'dripnex-tokens-'));
    storage = new TokenStorage(dir);
    isEncryptionAvailable.mockReset();
    encryptString.mockReset();
    decryptString.mockReset();
    encryptString.mockImplementation((value: string) => Buffer.from(`enc:${value}`, 'utf8'));
    decryptString.mockImplementation((value: Buffer) => {
      const text = value.toString('utf8');
      if (!text.startsWith('enc:')) {
        throw new Error('not encrypted');
      }
      return text.slice(4);
    });
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('round-trips tokens through safeStorage when encryption is available', async () => {
    isEncryptionAvailable.mockReturnValue(true);

    await storage.saveTokens(TOKENS.accessToken, TOKENS.refreshToken);

    const raw = await readFile(join(dir, 'auth.encrypted'));
    expect(raw.toString('utf8').startsWith('enc:')).toBe(true);
    await expect(storage.getTokens()).resolves.toEqual(TOKENS);
  });

  it('writes mode-0600 plaintext when encryption is unavailable', async () => {
    isEncryptionAvailable.mockReturnValue(false);

    await storage.saveTokens(TOKENS.accessToken, TOKENS.refreshToken);

    const path = join(dir, 'auth.encrypted');
    const raw = await readFile(path, 'utf8');
    expect(JSON.parse(raw)).toEqual(TOKENS);
    expect((await stat(path)).mode & 0o777).toBe(0o600);
    await expect(storage.getTokens()).resolves.toEqual(TOKENS);
  });

  it('reads a leftover plaintext file after encryption becomes available', async () => {
    isEncryptionAvailable.mockReturnValue(true);
    await writeFile(join(dir, 'auth.encrypted'), JSON.stringify(TOKENS), { mode: 0o600 });

    await expect(storage.getTokens()).resolves.toEqual(TOKENS);
    expect(decryptString).not.toHaveBeenCalled();
  });

  it('leaves an encrypted file intact when encryption is unavailable', async () => {
    isEncryptionAvailable.mockReturnValue(false);
    const path = join(dir, 'auth.encrypted');
    await writeFile(path, Buffer.from('enc:{"accessToken":"x","refreshToken":"y"}'));

    await expect(storage.getTokens()).resolves.toBeNull();
    await expect(readFile(path)).resolves.toBeTruthy();
  });

  it('returns null without deleting when decryption fails', async () => {
    isEncryptionAvailable.mockReturnValue(true);
    const path = join(dir, 'auth.encrypted');
    await writeFile(path, Buffer.from([0x00, 0x01, 0x02]));
    decryptString.mockImplementation(() => {
      throw new Error('locked');
    });

    await expect(storage.getTokens()).resolves.toBeNull();
    await expect(readFile(path)).resolves.toBeTruthy();
  });

  it('clearTokens removes the file', async () => {
    isEncryptionAvailable.mockReturnValue(false);
    await storage.saveTokens(TOKENS.accessToken, TOKENS.refreshToken);
    await expect(storage.hasTokens()).resolves.toBe(true);

    await storage.clearTokens();
    await expect(storage.hasTokens()).resolves.toBe(false);
    await expect(storage.getTokens()).resolves.toBeNull();
  });
});
