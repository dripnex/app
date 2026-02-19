import { defineConfig } from 'astro/config';
import icon from 'astro-icon';
import tailwind from '@astrojs/tailwind';
import react from '@astrojs/react';

export default defineConfig({
  site: 'https://readied.app',
  output: 'static',
  build: {
    assets: 'assets'
  },
  integrations: [icon(), tailwind({ applyBaseStyles: false }), react()]
});
