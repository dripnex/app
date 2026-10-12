import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const account = readFileSync(join(here, '../AccountSection.tsx'), 'utf8');
const app = readFileSync(join(here, '../../../../App.tsx'), 'utf8');
const settingsApp = readFileSync(join(here, '../../SettingsApp.tsx'), 'utf8');
const handlers = readFileSync(
  join(here, '../../../../../main/handlers/authSyncHandlers.ts'),
  'utf8'
);

describe('Settings → Account Sign Out', () => {
  it('calls a real logout and does not disable Sign Out while session hydrates', () => {
    expect(account).toContain('handleSignOut');
    expect(account).toContain('await logout()');
    expect(account).toContain('Sign Out');
    expect(account).not.toMatch(/disabled=\{isLoading\}/);
  });

  it('main and settings windows listen for auth:signed-out so AuthGate remounts', () => {
    expect(app).toContain('useAuthSessionEvents({ consumeMagicLink: true })');
    expect(settingsApp).toContain('useAuthSessionEvents()');
    expect(handlers).toContain("broadcastToWindows('auth:signed-out')");
    expect(handlers).toContain('clearTokens()');
    expect(handlers).toContain('localIdentity.clear()');
  });
});
