import { Vim } from '@replit/codemirror-vim';
import { dispatchCommand } from '../../hooks/useCommandRegistry';
import { VIM_EX_COMMANDS } from './exCommands';

export { VIM_EX_COMMANDS };

/** Register Inkdrop-style Ex commands. Safe to call again (redefines). */
export function registerVimExCommands(): void {
  for (const spec of VIM_EX_COMMANDS) {
    Vim.defineEx(spec.name, spec.short || undefined, () => {
      void dispatchCommand(spec.command);
    });
  }

  Vim.defineEx('cmd', 'cmd', (_cm, params) => {
    const command = params.args?.join(' ').trim();
    if (command) void dispatchCommand(command);
  });
}
