import { describe, expect, it } from 'vitest';
import {
  formatRecoveryKey,
  generatePassphrase,
  normalizeRecoveryKey,
  scorePassphrase,
} from '../passphrase';

describe('passphrase', () => {
  it('generates six wordlist words', () => {
    const phrase = generatePassphrase();
    const words = phrase.split(' ');
    expect(words).toHaveLength(6);
    expect(scorePassphrase(phrase).ok).toBe(true);
    expect(scorePassphrase(phrase).score).toBe(4);
  });

  it('rejects short custom secrets', () => {
    expect(scorePassphrase('hunter2').ok).toBe(false);
    expect(scorePassphrase('password').score).toBeLessThan(3);
  });

  it('formats and parses recovery keys', () => {
    const hex = 'aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899';
    const pretty = formatRecoveryKey(hex);
    expect(pretty).toContain('-');
    expect(normalizeRecoveryKey(pretty)).toBe(hex);
  });
});
