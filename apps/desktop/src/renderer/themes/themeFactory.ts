import type { ThemeDefinition } from '@dripnex/plugin-api';
import { hexToRgba } from '../components/auth/hexToRgba';

export interface PaletteSpec {
  id: string;
  name: string;
  description: string;
  colorScheme: 'dark' | 'light';
  frosted?: boolean;
  bg: { base: string; surface: string; elevated: string; inset: string };
  text: string;
  accent: string;
  accentHover: string;
  status: { active: string; onHold: string; completed: string; dropped: string };
}

/** Thin token layer over tokens.css — same contract a satellite theme.json uses. */
export function makePalette(spec: PaletteSpec): ThemeDefinition {
  const { text, accent } = spec;
  const theme: ThemeDefinition = {
    id: spec.id,
    name: spec.name,
    description: spec.description,
    author: 'Dripnex',
    colorScheme: spec.colorScheme,
    pluginId: 'dripnex-palette-library',
    tokens: {
      '--bg-base': spec.bg.base,
      '--bg-surface': spec.bg.surface,
      '--bg-elevated': spec.bg.elevated,
      '--bg-inset': spec.bg.inset,
      '--bg-hover': hexToRgba(text, 0.06),
      '--bg-active': hexToRgba(text, 0.1),
      '--text-primary': text,
      '--text-secondary': hexToRgba(text, 0.74),
      '--text-muted': hexToRgba(text, 0.5),
      '--text-faint': hexToRgba(text, 0.32),
      '--border': hexToRgba(text, 0.12),
      '--border-subtle': hexToRgba(text, 0.07),
      '--border-strong': hexToRgba(text, 0.2),
      '--accent': accent,
      '--accent-hover': spec.accentHover,
      '--accent-muted': hexToRgba(accent, 0.2),
      '--accent-subtle': hexToRgba(accent, 0.1),
      '--glass-bg': hexToRgba(spec.bg.base, 0.92),
      '--glass-border': hexToRgba(text, 0.1),
      '--glass-bg-menu': hexToRgba(spec.bg.elevated, 0.96),
      '--glass-border-menu': hexToRgba(text, 0.1),
      '--status-active': spec.status.active,
      '--status-on-hold': spec.status.onHold,
      '--status-completed': spec.status.completed,
      '--status-dropped': spec.status.dropped,
    },
  };
  if (spec.frosted) theme.frosted = true;
  return theme;
}
