import { describe, expect, it } from 'vitest';
import {
  AUTH_GATE_FORM_Z_INDEX,
  LOGIN_BACKDROP_Z_INDEX,
  formStacksAboveBackdrop,
} from '../authGateStacking';

describe('authGateStacking', () => {
  it('keeps the magic-link form above the LoginBackdrop canvas', () => {
    expect(AUTH_GATE_FORM_Z_INDEX).toBeGreaterThan(LOGIN_BACKDROP_Z_INDEX);
    expect(formStacksAboveBackdrop()).toBe(true);
    expect(formStacksAboveBackdrop(1, 0)).toBe(true);
    expect(formStacksAboveBackdrop(0, 0)).toBe(false);
  });
});
