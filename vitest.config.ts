import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Test environment
    environment: 'node',

    // Allow parallel execution for faster test runs
    // Tests use isolated output directories, so they can run in parallel
    fileParallelism: true,
    // Limit concurrent test files to avoid overwhelming the system
    maxConcurrency: 4,
    // Use test isolation to prevent shared state issues
    isolate: true,

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

    // Global setup - build once before all tests
    globalSetup: ['./tests/setup.ts'],

    // Reporter
    reporter: ['verbose'],

    // Globals
    globals: true,
  },
});
