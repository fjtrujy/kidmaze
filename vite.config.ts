import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset URLs allow the same build to work at /kidmaze/ on GitHub
  // Pages, at a custom domain, or from any other static subdirectory.
  base: './',
});
