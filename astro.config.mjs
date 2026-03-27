import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  output: 'static',
  adapter: cloudflare(),
  site: 'https://moihanatech.com',
  vite: {
    define: {
      'import.meta.env.API_BASE_URL': JSON.stringify(
        process.env.API_BASE_URL || 'https://api.moihanatech.com'
      ),
    },
  },
});