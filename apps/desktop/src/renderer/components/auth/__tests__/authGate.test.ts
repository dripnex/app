import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { AUTH_GATE_FORM_Z_INDEX } from '../authGateStacking';

const here = dirname(fileURLToPath(import.meta.url));
const authGate = readFileSync(join(here, '../AuthGate.tsx'), 'utf8');
const screenCss = readFileSync(join(here, '../AuthGate.module.css'), 'utf8');

describe('AuthGate form is in the tree when unauthenticated', () => {
  it('mounts the email field and magic-link action on the first window', () => {
    expect(authGate).toContain('id="auth-email"');
    expect(authGate).toContain('type="email"');
    expect(authGate).toContain('Email me a link');
    expect(authGate).toContain('<LoginBackdrop');
    expect(authGate).toContain('data-auth-gate="form"');
    expect(authGate).toContain('zIndex: AUTH_GATE_FORM_Z_INDEX');
    expect(AUTH_GATE_FORM_Z_INDEX).toBeGreaterThan(0);
  });

  it('has no continue-locally or guest skip', () => {
    expect(authGate).not.toContain('continueLocally');
    expect(authGate).not.toMatch(/onClick=\{[^}]*continueLocally/);
    expect(authGate).not.toMatch(/button[^>]*>[\s\S]*Continue locally/i);
    expect(authGate).not.toMatch(/Continue locally/);
  });

  it('isolates stacking so the canvas cannot cover the card', () => {
    expect(screenCss).toMatch(/\.screen\s*\{[^}]*isolation:\s*isolate/s);
    expect(screenCss).toMatch(/\.card\s*\{[^}]*z-index:\s*1/s);
    expect(screenCss).toContain('background: var(--glass-bg-fallback)');
    expect(screenCss).not.toMatch(/-webkit-app-region:\s*drag/);
  });

  it('plays GSAP gate-in on the card, not a CSS keyframe', () => {
    expect(authGate).toContain("playMotion('gate-in'");
    expect(authGate).toContain('cardRef');
    expect(screenCss).not.toMatch(/@keyframes/);
    expect(screenCss).not.toMatch(/animation:/);
  });
});
