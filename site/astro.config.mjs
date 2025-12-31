import { defineConfig } from 'astro/config';
import icon from 'astro-icon';

export default defineConfig({
  site: 'https://readied.app',
  output: 'static',
  build: {
    assets: 'assets'
  },
  integrations: [icon()]
});
