/** Vitest stand-in so unit tests do not load the real Electron binary. */
export const app = {
  getPath: (name: string) => `/tmp/dripnex-test/${name}`,
  getVersion: () => '0.0.0-test',
};

export const safeStorage = {
  isEncryptionAvailable: () => false,
  encryptString: (value: string) => Buffer.from(value),
  decryptString: (value: Buffer) => value.toString('utf8'),
};
