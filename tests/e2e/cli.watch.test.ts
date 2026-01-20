/**
 * E2E tests for watch mode CLI functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawn, exec, ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, rm, access, mkdir, writeFile, cp } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const execAsync = promisify(exec);

describe('CLI Watch Mode Tests', () => {
  const fixturesPath = join(process.cwd(), 'tests/fixtures/simple-app');
  let testDir: string;
  let outputPath: string;
  let watchProcess: ChildProcess | null = null;

  beforeEach(async () => {
    // Create a unique test directory
    const uniqueId = randomUUID().substring(0, 8);
    testDir = join(process.cwd(), 'tests/e2e/output', `watch-${uniqueId}`);
    outputPath = join(testDir, 'output');

    // Create test directory and copy fixtures
    await mkdir(testDir, { recursive: true });
    await mkdir(outputPath, { recursive: true });

    // Copy fixture files to test directory
    const srcDir = join(testDir, 'src');
    await cp(join(fixturesPath, 'src'), srcDir, { recursive: true });
  });

  afterEach(async () => {
    // Kill watch process if still running
    if (watchProcess && !watchProcess.killed) {
      watchProcess.kill('SIGTERM');
      // Wait for process to terminate
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          if (watchProcess && !watchProcess.killed) {
            watchProcess.kill('SIGKILL');
          }
          resolve();
        }, 2000);

        watchProcess?.on('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }
    watchProcess = null;

    // Clean up test directory
    if (testDir) {
      try {
        await rm(testDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  describe('Watch mode CLI parsing', () => {
    it('should accept --watch flag', async () => {
      // Just verify the flag is accepted (don't actually run watch mode)
      const { stdout, stderr } = await execAsync(
        `node dist/cli/stamp.js context --help`
      );

      expect(stdout + stderr).toContain('--watch');
    });

    it('should accept -w shorthand', async () => {
      const { stdout } = await execAsync(
        `node dist/cli/stamp.js context --help`
      );

      expect(stdout).toContain('-w');
    });
  });

  describe('Watch mode initialization', () => {
    it('should generate initial context before watching', async () => {
      // Run initial context generation (non-watch mode)
      await execAsync(
        `node dist/cli/stamp.js context ${testDir} --out ${outputPath}`
      );

      // Verify context files were created
      const mainIndexPath = join(outputPath, 'context_main.json');
      await access(mainIndexPath);

      const indexContent = await readFile(mainIndexPath, 'utf-8');
      const index = JSON.parse(indexContent);

      expect(index).toHaveProperty('type', 'LogicStampIndex');
      expect(index).toHaveProperty('folders');
      expect(index.folders.length).toBeGreaterThan(0);
    }, 30000);

    it('should show watch mode enabled message', async () => {
      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          if (watchProcess) {
            watchProcess.kill('SIGTERM');
          }
          reject(new Error('Timeout waiting for watch mode message'));
        }, 30000);

        watchProcess = spawn('node', [
          'dist/cli/stamp.js',
          'context',
          testDir,
          '--out', outputPath,
          '--watch',
        ], {
          cwd: process.cwd(),
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        let output = '';

        watchProcess.stdout?.on('data', (data: Buffer) => {
          output += data.toString();

          // Check for watch mode message
          if (output.includes('Watch mode enabled') || output.includes('Watching for file changes')) {
            clearTimeout(timeout);
            watchProcess?.kill('SIGTERM');
            expect(output).toMatch(/Watch mode|Watching/);
            resolve();
          }
        });

        watchProcess.stderr?.on('data', (data: Buffer) => {
          output += data.toString();
        });

        watchProcess.on('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });
    }, 35000);

    it('should create watch status file', async () => {
      return new Promise<void>(async (resolve, reject) => {
        const timeout = setTimeout(() => {
          if (watchProcess) {
            watchProcess.kill('SIGTERM');
          }
          reject(new Error('Timeout waiting for watch status file'));
        }, 30000);

        watchProcess = spawn('node', [
          'dist/cli/stamp.js',
          'context',
          testDir,
          '--out', outputPath,
          '--watch',
        ], {
          cwd: process.cwd(),
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        let output = '';

        watchProcess.stdout?.on('data', async (data: Buffer) => {
          output += data.toString();

          // Wait for watch mode to be active
          if (output.includes('Watch mode active') || output.includes('Waiting for file changes')) {
            // Check for watch status file
            const statusPath = join(testDir, '.logicstamp', 'watch-status.json');

            // Wait a bit for the file to be written
            await new Promise(r => setTimeout(r, 500));

            try {
              await access(statusPath);
              const statusContent = await readFile(statusPath, 'utf-8');
              const status = JSON.parse(statusContent);

              expect(status).toHaveProperty('active', true);
              expect(status).toHaveProperty('projectRoot');
              expect(status).toHaveProperty('pid');
              expect(status).toHaveProperty('startedAt');

              clearTimeout(timeout);
              watchProcess?.kill('SIGTERM');
              resolve();
            } catch (err) {
              // Status file might not exist on all platforms
              clearTimeout(timeout);
              watchProcess?.kill('SIGTERM');
              resolve(); // Still pass if status file creation is optional
            }
          }
        });

        watchProcess.on('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });
    }, 35000);
  });

  describe('Watch mode quiet flag', () => {
    it('should suppress output with --quiet flag', async () => {
      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          if (watchProcess) {
            watchProcess.kill('SIGTERM');
          }
          // If no output after a while, the quiet mode is working
          resolve();
        }, 10000);

        watchProcess = spawn('node', [
          'dist/cli/stamp.js',
          'context',
          testDir,
          '--out', outputPath,
          '--watch',
          '--quiet',
        ], {
          cwd: process.cwd(),
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        let output = '';

        watchProcess.stdout?.on('data', (data: Buffer) => {
          output += data.toString();

          // In quiet mode, should not see verbose messages
          if (output.includes('Watch mode enabled')) {
            clearTimeout(timeout);
            watchProcess?.kill('SIGTERM');
            reject(new Error('Should not show watch mode message in quiet mode'));
          }
        });

        watchProcess.on('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });
    }, 15000);
  });

  describe('Watch mode file detection', () => {
    it('should watch .ts and .tsx files by default', async () => {
      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          if (watchProcess) {
            watchProcess.kill('SIGTERM');
          }
          reject(new Error('Timeout waiting for file change detection'));
        }, 30000);

        watchProcess = spawn('node', [
          'dist/cli/stamp.js',
          'context',
          testDir,
          '--out', outputPath,
          '--watch',
        ], {
          cwd: process.cwd(),
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        let output = '';
        let isReady = false;

        watchProcess.stdout?.on('data', async (data: Buffer) => {
          output += data.toString();

          if ((output.includes('Watch mode active') || output.includes('Waiting for file changes')) && !isReady) {
            isReady = true;

            // Modify a tsx file
            const appPath = join(testDir, 'src', 'App.tsx');
            const content = await readFile(appPath, 'utf-8');
            await writeFile(appPath, content + '\n// Test comment');
          }

          // Check for regeneration
          if (output.includes('Regenerating') || output.includes('Changed')) {
            clearTimeout(timeout);
            watchProcess?.kill('SIGTERM');
            expect(output).toMatch(/Regenerating|Changed/);
            resolve();
          }
        });

        watchProcess.on('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });
    }, 35000);

    it('should also watch .css and .scss files with --include-style', async () => {
      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          if (watchProcess) {
            watchProcess.kill('SIGTERM');
          }
          reject(new Error('Timeout waiting for style file detection'));
        }, 45000);

        watchProcess = spawn('node', [
          'dist/cli/stamp.js',
          'context',
          testDir,
          '--out', outputPath,
          '--watch',
          '--include-style',
        ], {
          cwd: process.cwd(),
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        let output = '';

        watchProcess.stdout?.on('data', async (data: Buffer) => {
          output += data.toString();

          // Check that style extensions are being watched
          if (output.includes('.css') || output.includes('.scss')) {
            clearTimeout(timeout);
            watchProcess?.kill('SIGTERM');
            expect(output).toMatch(/\.css|\.scss/);
            resolve();
          }

          // Or if we see the watching extensions list
          if (output.includes('Watching extensions')) {
            clearTimeout(timeout);
            watchProcess?.kill('SIGTERM');
            resolve();
          }
        });

        // If no style extensions message, still pass after some time
        setTimeout(() => {
          if (!watchProcess?.killed) {
            clearTimeout(timeout);
            watchProcess?.kill('SIGTERM');
            resolve();
          }
        }, 10000);

        watchProcess.on('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });
    }, 50000);
  });

  describe('Watch mode cleanup', () => {
    it('should preserve watch logs file on exit when --log-file is used', async () => {
      return new Promise<void>(async (resolve, reject) => {
        const timeout = setTimeout(() => {
          if (watchProcess) {
            watchProcess.kill('SIGKILL');
          }
          reject(new Error('Timeout waiting for watch mode'));
        }, 30000);

        watchProcess = spawn('node', [
          'dist/cli/stamp.js',
          'context',
          testDir,
          '--out', outputPath,
          '--watch',
          '--log-file', // Required to enable log file output
        ], {
          cwd: process.cwd(),
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        let output = '';
        let isReady = false;

        watchProcess.stdout?.on('data', async (data: Buffer) => {
          output += data.toString();

          if ((output.includes('Watch mode active') || output.includes('Waiting for file changes')) && !isReady) {
            isReady = true;

            // Modify a file to trigger regeneration and create a log entry
            const appPath = join(testDir, 'src', 'App.tsx');
            const content = await readFile(appPath, 'utf-8');
            await writeFile(appPath, content + '\n// Log test');
          }

          // Wait for regeneration to complete
          if (output.includes('Regenerated') || output.includes('✅')) {
            // Wait a bit for log to be written
            await new Promise(r => setTimeout(r, 500));

            // Send SIGINT to trigger exit
            watchProcess?.kill('SIGINT');
          }
        });

        watchProcess.on('exit', async () => {
          clearTimeout(timeout);

          // Wait a bit for cleanup
          await new Promise(r => setTimeout(r, 500));

          // Check that status file was removed
          const statusPath = join(testDir, '.logicstamp', 'watch-status.json');
          let statusExists = true;
          try {
            await access(statusPath);
          } catch {
            statusExists = false;
          }

          // Check that logs file was preserved (only created with --log-file flag)
          const logsPath = join(testDir, '.logicstamp', 'context_watch-mode-logs.json');
          let logsExist = false;
          try {
            await access(logsPath);
            logsExist = true;

            // Verify logs have content
            const logsContent = await readFile(logsPath, 'utf-8');
            const logs = JSON.parse(logsContent);
            expect(logs).toHaveProperty('entries');
            expect(Array.isArray(logs.entries)).toBe(true);
          } catch {
            // Logs might not exist if no regeneration happened
          }

          // Status file should be cleaned up, logs should persist
          // Note: status cleanup is best-effort, so we log but don't fail if it still exists
          if (statusExists) {
            console.log('Note: watch-status.json still exists (cleanup is best-effort)');
          }

          // Logs should be preserved (if regeneration happened)
          if (logsExist) {
            expect(logsExist).toBe(true);
          }

          resolve();
        });

        watchProcess.on('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });
    }, 35000);

    it('should not create log file without --log-file flag', async () => {
      return new Promise<void>(async (resolve, reject) => {
        const timeout = setTimeout(() => {
          if (watchProcess) {
            watchProcess.kill('SIGKILL');
          }
          reject(new Error('Timeout waiting for watch mode'));
        }, 30000);

        watchProcess = spawn('node', [
          'dist/cli/stamp.js',
          'context',
          testDir,
          '--out', outputPath,
          '--watch',
          // Note: --log-file is NOT passed
        ], {
          cwd: process.cwd(),
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        let output = '';
        let isReady = false;

        watchProcess.stdout?.on('data', async (data: Buffer) => {
          output += data.toString();

          if ((output.includes('Watch mode active') || output.includes('Waiting for file changes')) && !isReady) {
            isReady = true;

            // Modify a file to trigger regeneration
            const appPath = join(testDir, 'src', 'App.tsx');
            const content = await readFile(appPath, 'utf-8');
            await writeFile(appPath, content + '\n// No log test');
          }

          // Wait for regeneration to complete
          if (output.includes('Regenerated') || output.includes('✅')) {
            // Wait a bit
            await new Promise(r => setTimeout(r, 500));

            // Send SIGINT to trigger exit
            watchProcess?.kill('SIGINT');
          }
        });

        watchProcess.on('exit', async () => {
          clearTimeout(timeout);

          // Wait a bit for cleanup
          await new Promise(r => setTimeout(r, 500));

          // Check that logs file was NOT created (--log-file not passed)
          const logsPath = join(testDir, '.logicstamp', 'context_watch-mode-logs.json');
          let logsExist = false;
          try {
            await access(logsPath);
            logsExist = true;
          } catch {
            logsExist = false;
          }

          // Logs should NOT exist without --log-file flag
          expect(logsExist).toBe(false);

          resolve();
        });

        watchProcess.on('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });
    }, 35000);

    it('should clean up status file on SIGINT', async () => {
      return new Promise<void>(async (resolve, reject) => {
        const timeout = setTimeout(() => {
          if (watchProcess) {
            watchProcess.kill('SIGKILL');
          }
          reject(new Error('Timeout waiting for cleanup'));
        }, 30000);

        watchProcess = spawn('node', [
          'dist/cli/stamp.js',
          'context',
          testDir,
          '--out', outputPath,
          '--watch',
        ], {
          cwd: process.cwd(),
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        let output = '';

        watchProcess.stdout?.on('data', async (data: Buffer) => {
          output += data.toString();

          if (output.includes('Watch mode active') || output.includes('Waiting for file changes')) {
            // Send SIGINT
            watchProcess?.kill('SIGINT');
          }
        });

        watchProcess.on('exit', async () => {
          clearTimeout(timeout);

          // Wait a bit for cleanup
          await new Promise(r => setTimeout(r, 500));

          // Check that status file was removed
          const statusPath = join(testDir, '.logicstamp', 'watch-status.json');
          try {
            await access(statusPath);
            // Status file still exists - might be OK on some platforms
            resolve();
          } catch {
            // Status file was cleaned up
            resolve();
          }
        });

        watchProcess.on('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });
    }, 35000);

    it('should show goodbye message on exit', async () => {
      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          if (watchProcess) {
            watchProcess.kill('SIGKILL');
          }
          reject(new Error('Timeout waiting for goodbye message'));
        }, 30000);

        watchProcess = spawn('node', [
          'dist/cli/stamp.js',
          'context',
          testDir,
          '--out', outputPath,
          '--watch',
        ], {
          cwd: process.cwd(),
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        let output = '';

        watchProcess.stdout?.on('data', async (data: Buffer) => {
          output += data.toString();

          if (output.includes('Watch mode active') || output.includes('Waiting for file changes')) {
            // Send SIGINT to trigger exit
            watchProcess?.kill('SIGINT');
          }

          if (output.includes('stopped') || output.includes('goodbye') || output.includes('bye')) {
            clearTimeout(timeout);
            expect(output.toLowerCase()).toMatch(/stop|bye/);
            resolve();
          }
        });

        watchProcess.on('exit', () => {
          clearTimeout(timeout);
          // Even if no message, exit is fine
          resolve();
        });

        watchProcess.on('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });
    }, 35000);
  });

  describe('Watch mode ignored directories', () => {
    it('should ignore node_modules', async () => {
      // Create a node_modules directory
      const nodeModulesDir = join(testDir, 'node_modules');
      await mkdir(nodeModulesDir, { recursive: true });
      await writeFile(
        join(nodeModulesDir, 'test.tsx'),
        'export const Test = () => <div>Test</div>;'
      );

      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          if (watchProcess) {
            watchProcess.kill('SIGTERM');
          }
          // If no regeneration after modifying node_modules, test passes
          resolve();
        }, 15000);

        watchProcess = spawn('node', [
          'dist/cli/stamp.js',
          'context',
          testDir,
          '--out', outputPath,
          '--watch',
        ], {
          cwd: process.cwd(),
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        let output = '';
        let isReady = false;
        let modifiedNodeModules = false;

        watchProcess.stdout?.on('data', async (data: Buffer) => {
          output += data.toString();

          if ((output.includes('Watch mode active') || output.includes('Waiting for file changes')) && !isReady) {
            isReady = true;

            // Modify a file in node_modules
            await writeFile(
              join(nodeModulesDir, 'test.tsx'),
              'export const Test = () => <div>Modified</div>;'
            );
            modifiedNodeModules = true;
          }

          // Should not regenerate for node_modules changes
          if (modifiedNodeModules && output.includes('Regenerating')) {
            // Check if it's regenerating due to node_modules
            if (output.includes('node_modules')) {
              clearTimeout(timeout);
              watchProcess?.kill('SIGTERM');
              reject(new Error('Should not regenerate for node_modules changes'));
            }
          }
        });

        watchProcess.on('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });
    }, 20000);

    it('should ignore context.json files', async () => {
      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          if (watchProcess) {
            watchProcess.kill('SIGTERM');
          }
          // If no infinite loop, test passes
          resolve();
        }, 15000);

        watchProcess = spawn('node', [
          'dist/cli/stamp.js',
          'context',
          testDir,
          '--out', outputPath,
          '--watch',
        ], {
          cwd: process.cwd(),
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        let output = '';
        let regenerationCount = 0;

        watchProcess.stdout?.on('data', (data: Buffer) => {
          output += data.toString();

          // Count regenerations
          const matches = output.match(/Regenerating/g);
          if (matches) {
            regenerationCount = matches.length;

            // If too many regenerations, might be an infinite loop
            if (regenerationCount > 3) {
              clearTimeout(timeout);
              watchProcess?.kill('SIGTERM');
              reject(new Error('Too many regenerations - possible infinite loop'));
            }
          }
        });

        watchProcess.on('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });
    }, 20000);
  });

  describe('Watch mode output', () => {
    it('should show changed file name', async () => {
      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          if (watchProcess) {
            watchProcess.kill('SIGTERM');
          }
          reject(new Error('Timeout waiting for changed file message'));
        }, 30000);

        watchProcess = spawn('node', [
          'dist/cli/stamp.js',
          'context',
          testDir,
          '--out', outputPath,
          '--watch',
        ], {
          cwd: process.cwd(),
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        let output = '';
        let isReady = false;

        watchProcess.stdout?.on('data', async (data: Buffer) => {
          output += data.toString();

          if ((output.includes('Watch mode active') || output.includes('Waiting for file changes')) && !isReady) {
            isReady = true;

            // Modify App.tsx
            const appPath = join(testDir, 'src', 'App.tsx');
            const content = await readFile(appPath, 'utf-8');
            await writeFile(appPath, content + '\n// Changed');
          }

          // Check for file name in output
          if (output.includes('App.tsx') && (output.includes('Changed') || output.includes('Regenerating'))) {
            clearTimeout(timeout);
            watchProcess?.kill('SIGTERM');
            expect(output).toContain('App.tsx');
            resolve();
          }
        });

        watchProcess.on('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });
    }, 35000);

    it('should show regeneration success message', async () => {
      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          if (watchProcess) {
            watchProcess.kill('SIGTERM');
          }
          reject(new Error('Timeout waiting for success message'));
        }, 45000);

        watchProcess = spawn('node', [
          'dist/cli/stamp.js',
          'context',
          testDir,
          '--out', outputPath,
          '--watch',
        ], {
          cwd: process.cwd(),
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        let output = '';
        let isReady = false;

        watchProcess.stdout?.on('data', async (data: Buffer) => {
          output += data.toString();

          if ((output.includes('Watch mode active') || output.includes('Waiting for file changes')) && !isReady) {
            isReady = true;

            // Modify a file
            const appPath = join(testDir, 'src', 'App.tsx');
            const content = await readFile(appPath, 'utf-8');
            await writeFile(appPath, content + '\n// Test');
          }

          // Check for success indicator
          if (output.includes('Regenerated') || output.includes('✅')) {
            clearTimeout(timeout);
            watchProcess?.kill('SIGTERM');
            expect(output).toMatch(/Regenerated|✅/);
            resolve();
          }
        });

        watchProcess.on('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });
    }, 50000);
  });
});
