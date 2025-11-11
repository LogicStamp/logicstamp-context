import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Test environment
    environment: 'node',

    // Run test files sequentially to avoid CLI conflicts
    fileParallelism: false,

    // Include patterns
    include: ['tests/**/*.test.ts'],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/types/**',
        'node_modules/**',
        'dist/**',
        'tests/**',
      ],
    },

    // Timeout for long-running E2E tests
    testTimeout: 30000,

    // Setup files
    setupFiles: [],

    // Reporter
    reporter: ['verbose'],

    // Globals
    globals: true,
  },
});
