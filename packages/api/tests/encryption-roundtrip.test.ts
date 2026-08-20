import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

function encrypt(key: Buffer, plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${encrypted.toString('base64')}:${authTag.toString('base64')}`;
}

function decrypt(key: Buffer, ciphertext: string): string {
  const [ivB64, dataB64, tagB64] = ciphertext.split(':');
  const iv = Buffer.from(ivB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');
  const authTag = Buffer.from(tagB64, 'base64');
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf-8');
}

describe('Encryption Round-Trip (AES-256-GCM)', () => {
  let key: Buffer;

  beforeEach(() => {
    key = randomBytes(KEY_LENGTH);
  });

  it('encrypt then decrypt returns original plaintext', () => {
    const plaintext = 'Hello, Dripnex!';
    const encrypted = encrypt(key, plaintext);
    const decrypted = decrypt(key, encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('encrypted output has correct format: {base64}:{base64}:{base64}', () => {
    const encrypted = encrypt(key, 'test content');
    const parts = encrypted.split(':');
    expect(parts).toHaveLength(3);

    const base64Regex = /^[A-Za-z0-9+/]+=*$/;
    for (const part of parts) {
      expect(part).toMatch(base64Regex);
    }

    // IV should be 12 bytes = 16 base64 chars
    const iv = Buffer.from(parts[0], 'base64');
    expect(iv.length).toBe(IV_LENGTH);

    // Auth tag should be 16 bytes
    const authTag = Buffer.from(parts[2], 'base64');
    expect(authTag.length).toBe(16);
  });

  it('decrypt with wrong key throws error', () => {
    const encrypted = encrypt(key, 'secret data');
    const wrongKey = randomBytes(KEY_LENGTH);
    expect(() => decrypt(wrongKey, encrypted)).toThrow();
  });

  it('decrypt with tampered ciphertext throws error (GCM auth tag check)', () => {
    const encrypted = encrypt(key, 'integrity check');
    const parts = encrypted.split(':');

    // Tamper with the ciphertext data
    const data = Buffer.from(parts[1], 'base64');
    data[0] ^= 0xff;
    parts[1] = data.toString('base64');

    const tampered = parts.join(':');
    expect(() => decrypt(key, tampered)).toThrow();
  });

  it('each encryption produces different IV (nonce uniqueness)', () => {
    const plaintext = 'same input';
    const encrypted1 = encrypt(key, plaintext);
    const encrypted2 = encrypt(key, plaintext);

    const iv1 = encrypted1.split(':')[0];
    const iv2 = encrypted2.split(':')[0];
    expect(iv1).not.toBe(iv2);

    // Both should still decrypt correctly
    expect(decrypt(key, encrypted1)).toBe(plaintext);
    expect(decrypt(key, encrypted2)).toBe(plaintext);
  });

  it('empty string encrypts and decrypts correctly', () => {
    const encrypted = encrypt(key, '');
    const decrypted = decrypt(key, encrypted);
    expect(decrypted).toBe('');
  });

  it('unicode content encrypts and decrypts correctly', () => {
    const plaintext = '日本語テスト 🚀 émojis café ñ 中文 العربية';
    const encrypted = encrypt(key, plaintext);
    const decrypted = decrypt(key, encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('large content (100KB) encrypts and decrypts correctly', () => {
    const plaintext = 'A'.repeat(100 * 1024);
    const encrypted = encrypt(key, plaintext);
    const decrypted = decrypt(key, encrypted);
    expect(decrypted).toBe(plaintext);
  });
});
