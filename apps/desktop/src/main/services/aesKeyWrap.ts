/**
 * AES Key Wrap (RFC 3394)
 *
 * Electron ships BoringSSL, which does not implement OpenSSL's `aes-256-wrap`
 * cipher. `createCipheriv('aes-256-wrap', ...)` therefore throws
 * `Error: Unknown cipher` in the main process, which broke passphrase setup
 * (the CEK could never be wrapped). Node-only test runs never caught it
 * because Vitest runs on Node/OpenSSL, where the cipher exists.
 *
 * RFC 3394 is defined directly on the raw AES block function, so we build it
 * from the one primitive BoringSSL does expose. Output is byte-identical to
 * `aes-256-wrap`, so keys wrapped by earlier builds still unwrap.
 *
 * NOTE ON ECB: `aes-256-ecb` here is the raw single-block AES call the spec
 * requires — never a mode for bulk data. Every call encrypts exactly one
 * 16-byte block with padding disabled. The chaining, integrity check and
 * IV handling are the RFC 3394 construction below, not ECB's.
 *
 * @module aesKeyWrap
 */

import { createCipheriv, createDecipheriv, timingSafeEqual } from 'crypto';

/** BoringSSL-available primitive. See the ECB note above before changing. */
export const AES_KW_CIPHER = 'aes-256-ecb';

/** RFC 3394 §2.2.3.1 default initial value. */
const AES_KW_DEFAULT_IV = Buffer.from('A6A6A6A6A6A6A6A6', 'hex');

/** RFC 3394 operates on 64-bit semiblocks. */
const SEMIBLOCK = 8;

/** RFC 3394 §2.2.1 fixes the wrapping loop at 6 passes. */
const ROUNDS = 6;

function encryptBlock(wrappingKey: Buffer, block: Buffer): Buffer {
  const cipher = createCipheriv(AES_KW_CIPHER, wrappingKey, null);
  cipher.setAutoPadding(false);
  return Buffer.concat([cipher.update(block), cipher.final()]);
}

function decryptBlock(wrappingKey: Buffer, block: Buffer): Buffer {
  const decipher = createDecipheriv(AES_KW_CIPHER, wrappingKey, null);
  decipher.setAutoPadding(false);
  return Buffer.concat([decipher.update(block), decipher.final()]);
}

/**
 * XOR the round counter `t` into a semiblock, big-endian.
 * Division keeps the arithmetic off the 32-bit bitwise operators.
 */
function xorCounter(semiblock: Buffer, t: number): void {
  let remaining = t;
  for (let byte = SEMIBLOCK - 1; byte >= 0 && remaining > 0; byte--) {
    semiblock.writeUInt8(semiblock.readUInt8(byte) ^ (remaining & 0xff), byte);
    remaining = Math.floor(remaining / 256);
  }
}

function toSemiblocks(data: Buffer, from: number): Buffer[] {
  const blocks: Buffer[] = [];
  for (let offset = from; offset < data.length; offset += SEMIBLOCK) {
    blocks.push(Buffer.from(data.subarray(offset, offset + SEMIBLOCK)));
  }
  return blocks;
}

/**
 * Wrap a key with AES-256-KW. Returns the key plus one semiblock of overhead.
 */
export function wrapKey(wrappingKey: Buffer, keyToWrap: Buffer): Buffer {
  if (keyToWrap.length < 2 * SEMIBLOCK || keyToWrap.length % SEMIBLOCK !== 0) {
    throw new Error(
      `AES-KW requires at least two 8-byte semiblocks, got ${keyToWrap.length} bytes`
    );
  }

  const r = toSemiblocks(keyToWrap, 0);
  const n = r.length;
  let a = Buffer.from(AES_KW_DEFAULT_IV);

  for (let j = 0; j < ROUNDS; j++) {
    for (let i = 1; i <= n; i++) {
      const b = encryptBlock(wrappingKey, Buffer.concat([a, r[i - 1]!]));
      a = Buffer.from(b.subarray(0, SEMIBLOCK));
      xorCounter(a, n * j + i);
      r[i - 1] = Buffer.from(b.subarray(SEMIBLOCK));
    }
  }

  return Buffer.concat([a, ...r]);
}

/**
 * Unwrap an AES-256-KW wrapped key.
 * Throws if the wrapping key is wrong or the ciphertext was tampered with —
 * RFC 3394's integrity check is the recovered IV.
 */
export function unwrapKey(wrappingKey: Buffer, wrappedKey: Buffer): Buffer {
  if (wrappedKey.length < 3 * SEMIBLOCK || wrappedKey.length % SEMIBLOCK !== 0) {
    throw new Error(`Malformed AES-KW ciphertext: ${wrappedKey.length} bytes`);
  }

  const r = toSemiblocks(wrappedKey, SEMIBLOCK);
  const n = r.length;
  let a = Buffer.from(wrappedKey.subarray(0, SEMIBLOCK));

  for (let j = ROUNDS - 1; j >= 0; j--) {
    for (let i = n; i >= 1; i--) {
      const counted = Buffer.from(a);
      xorCounter(counted, n * j + i);
      const b = decryptBlock(wrappingKey, Buffer.concat([counted, r[i - 1]!]));
      a = Buffer.from(b.subarray(0, SEMIBLOCK));
      r[i - 1] = Buffer.from(b.subarray(SEMIBLOCK));
    }
  }

  if (!timingSafeEqual(a, AES_KW_DEFAULT_IV)) {
    throw new Error('Failed to unwrap key — incorrect passphrase or corrupted data');
  }

  return Buffer.concat(r);
}
