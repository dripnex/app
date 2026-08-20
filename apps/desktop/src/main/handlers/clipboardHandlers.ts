import { clipboard } from 'electron';
import { z } from 'zod';
import { defineIpcHandler } from '../ipc/registry.js';

export function registerClipboardHandlers(): void {
  defineIpcHandler({
    channel: 'clipboard:readText',
    args: z.tuple([]),
    handler: () => clipboard.readText(),
  });

  defineIpcHandler({
    channel: 'clipboard:writeText',
    args: z.tuple([z.string().max(1024 * 1024)]),
    handler: text => {
      clipboard.writeText(text);
    },
  });
}
