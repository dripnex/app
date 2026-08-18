export const VIM_EX_COMMANDS = [
  { name: 'write', short: 'w', command: 'app:save-note' },
  { name: 'next', short: 'n', command: 'app:next-note' },
  { name: 'prev', short: '', command: 'app:prev-note' },
  { name: 'preview', short: 'p', command: 'app:toggle-preview' },
  { name: 'side-by-side', short: 'side', command: 'app:toggle-split' },
] as const;
