import { defineConfig } from 'vitest/config';

// Test runner (BLD-4). Kept apart from vite.config.ts, which loads the React and Tailwind plugins.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
