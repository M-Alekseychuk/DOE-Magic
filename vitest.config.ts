import { defineConfig } from 'vitest/config';

// Test runner (BLD-4). Kept apart from vite.config.ts, which loads the React and Tailwind plugins.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Snapshots are written only with `-u`: a missing snapshot fails instead of being created, and a
    // CRLF checkout (core.autocrlf on Windows) is not rewritten on every run.
    update: 'none',
  },
});
