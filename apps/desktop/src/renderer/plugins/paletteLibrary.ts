import type { PluginManifest } from '@dripnex/plugin-api';
import { PALETTE_LIBRARY } from '../themes/paletteLibrary';

export const paletteLibraryPlugin: PluginManifest = {
  id: 'dripnex-palette-library',
  name: 'Palette Library',
  version: '1.0.0',
  description: 'Sixteen first-party palettes. Choose one in Appearance.',

  activate(context) {
    const remove = PALETTE_LIBRARY.map(theme => context.registerTheme(theme));
    return {
      dispose() {
        for (const dispose of remove) dispose();
      },
    };
  },
};
