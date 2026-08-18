import { EditorView } from '@codemirror/view';
import { Vim } from '@replit/codemirror-vim';

export interface ClipboardHost {
  isEnabled(): boolean;
  readText(): Promise<string>;
  writeText(text: string): Promise<void>;
}

type VimWithGlobals = typeof Vim & {
  resetVimGlobalState_: () => void;
  getVimGlobalState_: () => {
    registerController: {
      unnamedRegister: {
        toString(): string;
        linewise: boolean;
        blockwise: boolean;
        setText: (...a: unknown[]) => void;
      };
      registers: Record<string, unknown>;
      pushText: (
        registerName: string | null | undefined,
        operator: string,
        text: string,
        linewise?: boolean,
        blockwise?: boolean
      ) => void;
    };
  };
};

let installed = false;

/**
 * Yank/delete without a register name syncs the unnamed register to the
 * system clipboard (`clipboard=unnamed`). Mirrors inkdrop-vim.
 */
export function installUnnamedClipboard(host: ClipboardHost): void {
  if (installed) return;
  installed = true;

  const vim = Vim as VimWithGlobals;
  const origReset = vim.resetVimGlobalState_;
  vim.resetVimGlobalState_ = () => {
    const previous = vim.getVimGlobalState_().registerController;
    const previousUnnamed = previous.unnamedRegister;
    const previousYank = previous.registers['0'];

    origReset.call(vim);
    const state = vim.getVimGlobalState_();

    state.registerController.unnamedRegister.setText(
      previousUnnamed.toString(),
      previousUnnamed.linewise,
      previousUnnamed.blockwise
    );
    if (previousYank) {
      state.registerController.registers['0'] = previousYank;
    }

    const origPush = state.registerController.pushText;
    state.registerController.pushText = (registerName, operator, text, linewise, blockwise) => {
      if (!registerName && host.isEnabled() && text) {
        void host.writeText(text);
      }
      origPush.call(state.registerController, registerName, operator, text, linewise, blockwise);
    };
  };

  vim.resetVimGlobalState_();
}

export function syncClipboardIntoUnnamed(host: ClipboardHost): void {
  if (!host.isEnabled()) return;
  void host.readText().then(text => {
    if (!text) return;
    Vim.getRegisterController().pushText('', 'yank', text, text.includes('\n'));
  });
}

export function clipboardOnFocus(host: ClipboardHost) {
  return EditorView.updateListener.of(update => {
    if (update.focusChanged && update.view.hasFocus) {
      syncClipboardIntoUnnamed(host);
    }
  });
}
