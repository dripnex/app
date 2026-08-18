import { PASSPHRASE_WORDS } from './passphraseWords';

export const GENERATED_WORD_COUNT = 6;
export const MIN_CUSTOM_SCORE = 3;

export function generatePassphrase(wordCount = GENERATED_WORD_COUNT): string {
  const words: string[] = [];
  const pool = PASSPHRASE_WORDS.length;
  const bytes = new Uint32Array(wordCount);
  crypto.getRandomValues(bytes);
  for (const value of bytes) {
    words.push(PASSPHRASE_WORDS[value % pool]!);
  }
  return words.join(' ');
}

export function scorePassphrase(value: string): { score: 0 | 1 | 2 | 3 | 4; label: string; ok: boolean } {
  const trimmed = value.trim();
  if (!trimmed) return { score: 0, label: 'Too short', ok: false };

  const tokens = trimmed.toLowerCase().split(/\s+/).filter(Boolean);
  const fromWordlist = tokens.filter(t => PASSPHRASE_WORD_SET.has(t)).length;

  if (fromWordlist >= 6) return { score: 4, label: 'Strong (generated)', ok: true };
  if (fromWordlist === 5) return { score: 3, label: 'Good', ok: true };

  const length = trimmed.length;
  const classes =
    Number(/[a-z]/.test(trimmed)) +
    Number(/[A-Z]/.test(trimmed)) +
    Number(/\d/.test(trimmed)) +
    Number(/[^A-Za-z0-9]/.test(trimmed));

  if (length >= 20 && classes >= 3) return { score: 4, label: 'Strong', ok: true };
  if (length >= 16 && classes >= 2) return { score: 3, label: 'Good', ok: true };
  if (length >= 12) return { score: 2, label: 'Fair — add words or length', ok: false };
  if (length >= 8) return { score: 1, label: 'Weak — easy to guess', ok: false };
  return { score: 0, label: 'Too short', ok: false };
}

export function formatRecoveryKey(hex: string): string {
  const clean = normalizeRecoveryKey(hex);
  return clean.match(/.{1,4}/g)?.join('-') ?? clean;
}

export function normalizeRecoveryKey(input: string): string {
  return input.replace(/[\s\-]/g, '').toLowerCase();
}

const PASSPHRASE_WORD_SET = new Set(PASSPHRASE_WORDS);
