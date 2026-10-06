// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://0xwb7.xyz',
  
  markdown: {
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' }
    }
  },
  vite: {
    plugins: [tailwindcss()]
  }
});
