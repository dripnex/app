import type { CommandDefinition } from '../types';

export const aiCommands: CommandDefinition[] = [
  {
    id: 'ai:toggle-panel',
    name: 'Toggle AI Panel',
    category: 'ai',
    context: 'global',
    defaultKeybinding: { key: 'k', modifiers: ['Mod'] },
    icon: 'Sparkles',
    showInPalette: true,
  },
  {
    id: 'ai:summarize',
    name: 'Summarize Selection',
    category: 'ai',
    context: 'editor',
    icon: 'FileText',
    showInPalette: true,
  },
  {
    id: 'ai:rewrite',
    name: 'Rewrite Selection',
    category: 'ai',
    context: 'editor',
    icon: 'RefreshCw',
    showInPalette: true,
  },
  {
    id: 'ai:tweet',
    name: 'Convert to Tweet',
    category: 'ai',
    context: 'editor',
    icon: 'Twitter',
    showInPalette: true,
  },
];
