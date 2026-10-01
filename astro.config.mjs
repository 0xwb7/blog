// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  markdown: {
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' }
    }
  },
  vite: {
    plugins: [tailwindcss()]
  }
});
