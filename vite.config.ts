import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

const packageJson = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { version: string };

export default defineConfig({
  // Relative asset URLs allow the same build to work at /kidmaze/ on GitHub
  // Pages, at a custom domain, or from any other static subdirectory.
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
});
