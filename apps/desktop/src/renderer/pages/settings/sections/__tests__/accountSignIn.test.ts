import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const account = readFileSync(join(here, '../AccountSection.tsx'), 'utf8');
const magicLink = readFileSync(join(here, '../../../../components/auth/MagicLinkFlow.tsx'), 'utf8');

describe('Settings → Account Sign In', () => {
  it('opens the magic-link email flow instead of a dead Sign In button', () => {
    expect(account).toContain('handleSignIn');
    expect(account).toContain('setShowMagicLinkFlow(true)');
    expect(account).toContain('{showMagicLinkFlow &&');
    expect(account).toContain('<MagicLinkFlow');
    expect(account).not.toMatch(/continue locally/i);
  });

  it('portals the email field out of the Settings overflow clip', () => {
    expect(magicLink).toContain('createPortal');
    expect(magicLink).toContain('document.body');
    expect(magicLink).toContain('id="settings-auth-email"');
    expect(magicLink).toContain('htmlFor="settings-auth-email"');
    expect(magicLink).toContain('Send Magic Link');
    expect(magicLink).toContain('data-auth-gate="magic-link"');
    const css = readFileSync(
      join(here, '../../../../components/auth/MagicLinkFlow.module.css'),
      'utf8'
    );
    expect(css).not.toMatch(/backdrop-filter/);
    expect(css).toContain('background: var(--glass-bg-fallback)');
    expect(css).toMatch(/\.overlay\s*\{[^}]*isolation:\s*isolate/s);
  });
});
