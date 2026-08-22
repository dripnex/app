/**
 * AES Key Wrap (RFC 3394) — byte-compatibility with OpenSSL `aes-256-wrap`.
 *
 * Electron ships BoringSSL, which does not implement the `aes-256-wrap`
 * cipher, so `createCipheriv('aes-256-wrap', ...)` throws `Unknown cipher`
 * in the main process. These vectors pin the replacement implementation to
 * the exact bytes OpenSSL produced, so keys wrapped by older builds still
 * unwrap.
 */

import { describe, expect, it } from 'vitest';
import { AES_KW_CIPHER, unwrapKey, wrapKey } from '../aesKeyWrap';

// RFC 3394 §4.6 — wrap 256 bits of key data with a 256-bit KEK.
const RFC3394_KEK = Buffer.from(
  '000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F',
  'hex'
);
const RFC3394_KEY = Buffer.from(
  '00112233445566778899AABBCCDDEEFF000102030405060708090A0B0C0D0E0F',
  'hex'
);
const RFC3394_WRAPPED = Buffer.from(
  '28C9F404C4B810F4CBCCB35CFB87F8263F5786E2D80ED326CBC7F0E71A99F43BFB988B9B7A02DD21',
  'hex'
);

describe('wrapKey', () => {
  it('produces the RFC 3394 §4.6 vector for a 256-bit key', () => {
    expect(wrapKey(RFC3394_KEK, RFC3394_KEY).toString('hex')).toBe(RFC3394_WRAPPED.toString('hex'));
  });

  it('appends one 8-byte block of overhead', () => {
    expect(wrapKey(RFC3394_KEK, RFC3394_KEY)).toHaveLength(RFC3394_KEY.length + 8);
  });
});

describe('unwrapKey', () => {
  it('recovers the key from the RFC 3394 §4.6 vector', () => {
    expect(unwrapKey(RFC3394_KEK, RFC3394_WRAPPED).toString('hex')).toBe(
      RFC3394_KEY.toString('hex')
    );
  });

  it('rejects a wrapped key that was tampered with', () => {
    const tampered = Buffer.from(RFC3394_WRAPPED);
    tampered.writeUInt8(tampered.readUInt8(0) ^ 0xff, 0);
    expect(() => unwrapKey(RFC3394_KEK, tampered)).toThrow();
  });

  it('rejects the wrong wrapping key', () => {
    const wrongKek = Buffer.alloc(32, 0x42);
    expect(() => unwrapKey(wrongKek, RFC3394_WRAPPED)).toThrow();
  });
});

describe('AES_KW_CIPHER', () => {
  it('is a cipher BoringSSL implements, so the Electron main process can use it', () => {
    // `aes-256-wrap` exists in OpenSSL (and therefore in Vitest, which runs on
    // Node) but NOT in BoringSSL. Pinning this constant stops a well-meaning
    // revert to the built-in cipher from shipping a broken passphrase setup.
    expect(AES_KW_CIPHER).toBe('aes-256-ecb');
  });
});
