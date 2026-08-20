import { z } from 'zod';
import { defineIpcHandler } from '../../ipc/registry.js';
import {
  discoverOpAccounts,
  readStoredAccount,
  saveLoginItem,
  saveToOnePassword,
  writeStoredAccount,
} from './service.js';

export interface OnePasswordHandlerDeps {
  dataDir: string;
  getAppVersion: () => string;
}

const AccountSchema = z.string().max(256).optional().nullable();
const EmailSchema = z.string().max(254).optional().nullable();
const PassphraseSchema = z.string().min(1).max(1024);
const RecoverySchema = z.string().max(512).optional().nullable();

export function registerOnePasswordHandlers(deps: OnePasswordHandlerDeps): void {
  defineIpcHandler({
    channel: 'integrations:onepassword:discover',
    args: z.tuple([]),
    handler: async () => {
      const [stored, accounts] = await Promise.all([
        readStoredAccount(deps.dataDir),
        discoverOpAccounts(),
      ]);
      return { success: true as const, stored, accounts };
    },
  });

  defineIpcHandler({
    channel: 'integrations:onepassword:setAccount',
    args: z.tuple([z.string().min(1).max(256)]),
    handler: async account => {
      const trimmed = account.trim();
      await writeStoredAccount(deps.dataDir, trimmed);
      return { success: true as const, account: trimmed };
    },
  });

  defineIpcHandler({
    channel: 'integrations:onepassword:save',
    args: z.tuple([
      z.object({
        account: AccountSchema,
        email: EmailSchema,
        passphrase: PassphraseSchema,
        recoveryKey: RecoverySchema,
      }),
    ]),
    handler: input =>
      saveToOnePassword(deps.dataDir, {
        ...input,
        appVersion: deps.getAppVersion(),
      }),
  });

  defineIpcHandler({
    channel: 'integrations:onepassword:saveSecret',
    args: z.tuple([
      z.object({
        account: AccountSchema,
        title: z.string().min(1).max(128),
        username: z.string().min(1).max(128),
        password: z.string().min(1).max(4096),
        notes: z.string().max(2000).optional().default(''),
        websiteUrl: z.string().url().max(512),
        websiteLabel: z.string().min(1).max(64),
      }),
    ]),
    handler: input =>
      saveLoginItem(deps.dataDir, {
        ...input,
        notes: input.notes ?? '',
        appVersion: deps.getAppVersion(),
      }),
  });
}
