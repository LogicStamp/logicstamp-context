import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getConfigDir,
  getConfigPath,
  configExists,
  readConfig,
  writeConfig,
  updateConfig,
  getWatchStatusPath,
  isWatchModeActive,
  readWatchStatus,
  writeWatchStatus,
  deleteWatchStatus,
  getWatchLogsPath,
  readWatchLogs,
  appendWatchLog,
  clearWatchLogs,
  getStrictWatchReportPath,
  readStrictWatchStatus,
  writeStrictWatchStatus,
  deleteStrictWatchStatus,
} from '../../../src/utils/config.js';
import { readFile, writeFile, mkdir, access, unlink } from 'fs/promises';
import { join } from 'path';
import { mkdtemp } from 'fs/promises';
import { tmpdir } from 'os';
import { vi } from 'vitest';

describe('config utils', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'logicstamp-test-'));
  });

  afterEach(async () => {
    // Cleanup is handled by temp directory, but we can try to remove it
    try {
      await unlink(join(testDir, '.logicstamp', 'config.json')).catch(() => {});
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('getConfigDir', () => {
    it('should return config directory path', () => {
      const configDir = getConfigDir(testDir);
      expect(configDir).toBe(join(testDir, '.logicstamp'));
    });
  });

  describe('getConfigPath', () => {
    it('should return config file path', () => {
      const configPath = getConfigPath(testDir);
      expect(configPath).toBe(join(testDir, '.logicstamp', 'config.json'));
    });
  });

  describe('configExists', () => {
    it('should return false when config does not exist', async () => {
      const exists = await configExists(testDir);
      expect(exists).toBe(false);
    });

    it('should return true when config exists', async () => {
      // Create config directory and file
      await mkdir(join(testDir, '.logicstamp'), { recursive: true });
      await writeFile(join(testDir, '.logicstamp', 'config.json'), '{}');

      const exists = await configExists(testDir);
      expect(exists).toBe(true);
    });
  });

  describe('readConfig', () => {
    it('should return empty object when config does not exist', async () => {
      const config = await readConfig(testDir);
      expect(config).toEqual({});
    });

    it('should read config from disk', async () => {
      const testConfig = { gitignorePreference: 'added' };
      await mkdir(join(testDir, '.logicstamp'), { recursive: true });
      await writeFile(
        join(testDir, '.logicstamp', 'config.json'),
        JSON.stringify(testConfig)
      );

      const config = await readConfig(testDir);
      expect(config).toEqual(testConfig);
    });

    it('should handle invalid JSON gracefully', async () => {
      await mkdir(join(testDir, '.logicstamp'), { recursive: true });
      await writeFile(join(testDir, '.logicstamp', 'config.json'), 'invalid json');

      // Should return empty object on parse error
      const config = await readConfig(testDir);
      expect(config).toEqual({});
    });
  });

  describe('writeConfig', () => {
    it('should write config to disk', async () => {
      const testConfig = { gitignorePreference: 'added', llmContextPreference: 'skipped' };
      await writeConfig(testDir, testConfig);

      const configPath = join(testDir, '.logicstamp', 'config.json');
      const content = await readFile(configPath, 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed).toEqual(testConfig);
    });

    it('should create config directory if it does not exist', async () => {
      const testConfig = { gitignorePreference: 'added' };
      await writeConfig(testDir, testConfig);

      const configDir = join(testDir, '.logicstamp');
      const dirExists = await access(configDir).then(() => true).catch(() => false);
      expect(dirExists).toBe(true);
    });
  });

  describe('updateConfig', () => {
    it('should merge with existing config', async () => {
      const initialConfig = { gitignorePreference: 'added' };
      await writeConfig(testDir, initialConfig);

      await updateConfig(testDir, { llmContextPreference: 'skipped' });

      const config = await readConfig(testDir);
      expect(config).toEqual({
        gitignorePreference: 'added',
        llmContextPreference: 'skipped',
      });
    });

    it('should create config if it does not exist', async () => {
      await updateConfig(testDir, { gitignorePreference: 'added' });

      const config = await readConfig(testDir);
      expect(config).toEqual({ gitignorePreference: 'added' });
    });
  });

  describe('watch status', () => {
    describe('getWatchStatusPath', () => {
      it('should return watch status file path', () => {
        const statusPath = getWatchStatusPath(testDir);
        expect(statusPath).toBe(join(testDir, '.logicstamp', 'context_watch-status.json'));
      });
    });

    describe('isWatchModeActive', () => {
      it('should return false when status file does not exist', async () => {
        const isActive = await isWatchModeActive(testDir);
        expect(isActive).toBe(false);
      });

      it('should return false when process does not exist', async () => {
        await mkdir(join(testDir, '.logicstamp'), { recursive: true });
        const status = {
          active: true,
          projectRoot: testDir,
          pid: 999999, // Non-existent PID
          startedAt: new Date().toISOString(),
        };
        await writeFile(
          join(testDir, '.logicstamp', 'context_watch-status.json'),
          JSON.stringify(status)
        );

        const isActive = await isWatchModeActive(testDir);
        expect(isActive).toBe(false);
      });
    });

    describe('readWatchStatus', () => {
      it('should return null when status file does not exist', async () => {
        const status = await readWatchStatus(testDir);
        expect(status).toBeNull();
      });

      it('should read status from disk', async () => {
        const testStatus = {
          active: true,
          projectRoot: testDir,
          pid: process.pid,
          startedAt: new Date().toISOString(),
        };
        await mkdir(join(testDir, '.logicstamp'), { recursive: true });
        await writeFile(
          join(testDir, '.logicstamp', 'context_watch-status.json'),
          JSON.stringify(testStatus)
        );

        const status = await readWatchStatus(testDir);
        expect(status).toEqual(testStatus);
      });
    });

    describe('writeWatchStatus', () => {
      it('should write status to disk', async () => {
        const testStatus = {
          active: true,
          projectRoot: testDir,
          pid: process.pid,
          startedAt: new Date().toISOString(),
        };
        await writeWatchStatus(testDir, testStatus);

        const statusPath = join(testDir, '.logicstamp', 'context_watch-status.json');
        const content = await readFile(statusPath, 'utf-8');
        const parsed = JSON.parse(content);
        expect(parsed).toEqual(testStatus);
      });
    });

    describe('deleteWatchStatus', () => {
      it('should delete status file', async () => {
        await mkdir(join(testDir, '.logicstamp'), { recursive: true });
        await writeFile(
          join(testDir, '.logicstamp', 'context_watch-status.json'),
          '{}'
        );

        await deleteWatchStatus(testDir);

        const exists = await access(
          join(testDir, '.logicstamp', 'context_watch-status.json')
        )
          .then(() => true)
          .catch(() => false);
        expect(exists).toBe(false);
      });

      it('should not throw when file does not exist', async () => {
        await expect(deleteWatchStatus(testDir)).resolves.not.toThrow();
      });
    });
  });

  describe('watch logs', () => {
    describe('getWatchLogsPath', () => {
      it('should return watch logs file path', () => {
        const logsPath = getWatchLogsPath(testDir);
        expect(logsPath).toBe(join(testDir, '.logicstamp', 'context_watch-mode-logs.json'));
      });
    });

    describe('readWatchLogs', () => {
      it('should return empty logs when file does not exist', async () => {
        const logs = await readWatchLogs(testDir);
        expect(logs).toEqual({ entries: [], maxEntries: 100 });
      });

      it('should read logs from disk', async () => {
        const testLogs = {
          entries: [
            {
              timestamp: new Date().toISOString(),
              changedFiles: ['src/App.tsx'],
              fileCount: 1,
            },
          ],
          maxEntries: 100,
        };
        await mkdir(join(testDir, '.logicstamp'), { recursive: true });
        await writeFile(
          join(testDir, '.logicstamp', 'context_watch-mode-logs.json'),
          JSON.stringify(testLogs)
        );

        const logs = await readWatchLogs(testDir);
        expect(logs).toEqual(testLogs);
      });
    });

    describe('appendWatchLog', () => {
      it('should append log entry', async () => {
        const entry = {
          timestamp: new Date().toISOString(),
          changedFiles: ['src/App.tsx'],
          fileCount: 1,
        };
        await appendWatchLog(testDir, entry);

        const logs = await readWatchLogs(testDir);
        expect(logs.entries).toHaveLength(1);
        expect(logs.entries[0]).toEqual(entry);
      });

      it('should limit entries to maxEntries', async () => {
        await mkdir(join(testDir, '.logicstamp'), { recursive: true });
        await writeFile(
          join(testDir, '.logicstamp', 'context_watch-mode-logs.json'),
          JSON.stringify({ entries: [], maxEntries: 2 })
        );

        for (let i = 0; i < 5; i++) {
          await appendWatchLog(testDir, {
            timestamp: new Date().toISOString(),
            changedFiles: [`file${i}.tsx`],
            fileCount: 1,
          });
        }

        const logs = await readWatchLogs(testDir);
        expect(logs.entries).toHaveLength(2);
      });
    });

    describe('clearWatchLogs', () => {
      it('should delete logs file', async () => {
        await mkdir(join(testDir, '.logicstamp'), { recursive: true });
        await writeFile(
          join(testDir, '.logicstamp', 'context_watch-mode-logs.json'),
          '{}'
        );

        await clearWatchLogs(testDir);

        const exists = await access(
          join(testDir, '.logicstamp', 'context_watch-mode-logs.json')
        )
          .then(() => true)
          .catch(() => false);
        expect(exists).toBe(false);
      });
    });
  });

  describe('strict watch status', () => {
    describe('getStrictWatchReportPath', () => {
      it('should return strict watch report path', () => {
        const reportPath = getStrictWatchReportPath(testDir);
        expect(reportPath).toBe(join(testDir, '.logicstamp', 'strict_watch_violations.json'));
      });
    });

    describe('readStrictWatchStatus', () => {
      it('should return null when file does not exist', async () => {
        const status = await readStrictWatchStatus(testDir);
        expect(status).toBeNull();
      });

      it('should read status from disk', async () => {
        const testStatus = {
          active: true,
          startedAt: new Date().toISOString(),
          cumulativeViolations: 5,
          cumulativeErrors: 2,
          cumulativeWarnings: 3,
          regenerationCount: 10,
        };
        await mkdir(join(testDir, '.logicstamp'), { recursive: true });
        await writeFile(
          join(testDir, '.logicstamp', 'strict_watch_violations.json'),
          JSON.stringify(testStatus)
        );

        const status = await readStrictWatchStatus(testDir);
        expect(status).toEqual(testStatus);
      });
    });

    describe('writeStrictWatchStatus', () => {
      it('should write status to disk', async () => {
        const testStatus = {
          active: true,
          startedAt: new Date().toISOString(),
          cumulativeViolations: 0,
          cumulativeErrors: 0,
          cumulativeWarnings: 0,
          regenerationCount: 0,
        };
        await writeStrictWatchStatus(testDir, testStatus);

        const reportPath = join(testDir, '.logicstamp', 'strict_watch_violations.json');
        const content = await readFile(reportPath, 'utf-8');
        const parsed = JSON.parse(content);
        expect(parsed).toEqual(testStatus);
      });
    });

    describe('deleteStrictWatchStatus', () => {
      it('should delete status file', async () => {
        await mkdir(join(testDir, '.logicstamp'), { recursive: true });
        await writeFile(
          join(testDir, '.logicstamp', 'strict_watch_violations.json'),
          '{}'
        );

        await deleteStrictWatchStatus(testDir);

        const exists = await access(
          join(testDir, '.logicstamp', 'strict_watch_violations.json')
        )
          .then(() => true)
          .catch(() => false);
        expect(exists).toBe(false);
      });
    });
  });
});
