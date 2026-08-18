export type VimModeBits = {
  insertMode?: boolean;
  visualMode?: boolean;
  visualLine?: boolean;
  visualBlock?: boolean;
  exMode?: boolean;
  mode?: string;
};

export function vimModeLabel(state: VimModeBits | null | undefined): string {
  if (!state) return 'NORMAL';
  if (state.exMode) return 'COMMAND';
  if (state.insertMode) return state.mode === 'replace' ? 'REPLACE' : 'INSERT';
  if (state.visualMode) {
    if (state.visualLine) return 'V-LINE';
    if (state.visualBlock) return 'V-BLOCK';
    return 'VISUAL';
  }
  return 'NORMAL';
}
