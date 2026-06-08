/**
 * Typed IPC handler registry.
 *
 * Wraps `ipcMain.handle()` with Zod validation at the boundary. Renderer
 * input is treated as untrusted: if the schema doesn't accept the args,
 * the handler throws BEFORE the business logic runs, and the renderer
 * sees a structured "invalid args" error instead of a downstream crash.
 *
 * Pattern:
 *
 *   defineIpcHandler({
 *     channel: 'ai:saveKey',
 *     args: z.tuple([z.string().min(1), z.string().min(1)]),
 *     handler: (provider, apiKey) => aiKeyStorage.saveKey(provider, apiKey),
 *   });
 *
 * Notes:
 * - `args` is a Zod tuple matching the positional renderer arguments.
 *   Use `z.tuple([])` for no-arg handlers.
 * - The schema runs on every invocation. Keep it tight (length caps,
 *   enums) — schemas are the contract.
 */

import { ipcMain } from 'electron';
import { z } from 'zod';

export interface DefineIpcHandlerConfig<
  Schema extends z.ZodTuple<z.ZodTypeAny[], z.ZodTypeAny | null>,
  Return,
> {
  /** IPC channel name (e.g. 'ai:saveKey'). Must be unique. */
  channel: string;
  /** Zod tuple describing the positional args sent by the renderer. */
  args: Schema;
  /** Business logic. Receives validated args, never raw input. */
  handler: (...args: z.infer<Schema>) => Promise<Return> | Return;
}

export class IpcValidationError extends Error {
  readonly channel: string;
  constructor(channel: string, message: string) {
    super(`Invalid IPC args for "${channel}": ${message}`);
    this.name = 'IpcValidationError';
    this.channel = channel;
  }
}

export function defineIpcHandler<
  Schema extends z.ZodTuple<z.ZodTypeAny[], z.ZodTypeAny | null>,
  Return,
>(config: DefineIpcHandlerConfig<Schema, Return>): void {
  ipcMain.handle(config.channel, async (_event, ...rawArgs: unknown[]) => {
    const parsed = config.args.safeParse(rawArgs);
    if (!parsed.success) {
      throw new IpcValidationError(config.channel, parsed.error.message);
    }
    return config.handler(...(parsed.data as z.infer<Schema>));
  });
}
