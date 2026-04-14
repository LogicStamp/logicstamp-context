import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { debugLog, debugError } from '../../../src/utils/debug.js';

describe('debug utilities', () => {
  const originalEnv = process.env.LOGICSTAMP_DEBUG;

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.LOGICSTAMP_DEBUG = originalEnv;
    vi.restoreAllMocks();
  });

  describe('debugLog', () => {
    it('should not log when LOGICSTAMP_DEBUG is not set', () => {
      delete process.env.LOGICSTAMP_DEBUG;

      debugLog('test', 'message');

      expect(console.log).not.toHaveBeenCalled();
    });

    it('should not log when LOGICSTAMP_DEBUG is not "1"', () => {
      process.env.LOGICSTAMP_DEBUG = '0';

      debugLog('test', 'message');

      expect(console.log).not.toHaveBeenCalled();
    });

    it('should log without context when LOGICSTAMP_DEBUG is "1" and no context provided', () => {
      process.env.LOGICSTAMP_DEBUG = '1';

      debugLog('testModule', 'test message');

      expect(console.log).toHaveBeenCalledTimes(1);
      expect(console.log).toHaveBeenCalledWith(
        '[LogicStamp][DEBUG] testModule: test message',
      );
    });

    it('should log with context when LOGICSTAMP_DEBUG is "1" and context provided', () => {
      process.env.LOGICSTAMP_DEBUG = '1';
      const context = { file: 'test.ts', line: 42 };

      debugLog('testModule', 'test message', context);

      expect(console.log).toHaveBeenCalledTimes(1);
      expect(console.log).toHaveBeenCalledWith(
        '[LogicStamp][DEBUG] testModule: test message',
        context,
      );
    });

    it('should log with empty context object when provided', () => {
      process.env.LOGICSTAMP_DEBUG = '1';
      const context = {};

      debugLog('testModule', 'test message', context);

      expect(console.log).toHaveBeenCalledTimes(1);
      expect(console.log).toHaveBeenCalledWith(
        '[LogicStamp][DEBUG] testModule: test message',
        context,
      );
    });
  });

  describe('debugError', () => {
    it('should not log when LOGICSTAMP_DEBUG is not set', () => {
      delete process.env.LOGICSTAMP_DEBUG;

      debugError('test', 'functionName', { error: 'test error' });

      expect(console.error).not.toHaveBeenCalled();
    });

    it('should not log when LOGICSTAMP_DEBUG is not "1"', () => {
      process.env.LOGICSTAMP_DEBUG = 'false';

      debugError('test', 'functionName', { error: 'test error' });

      expect(console.error).not.toHaveBeenCalled();
    });

    it('should log error when LOGICSTAMP_DEBUG is "1"', () => {
      process.env.LOGICSTAMP_DEBUG = '1';
      const context = { error: 'test error', path: '/test/file.ts' };

      debugError('testModule', 'testFunction', context);

      expect(console.error).toHaveBeenCalledTimes(1);
      expect(console.error).toHaveBeenCalledWith(
        '[LogicStamp][DEBUG] testModule.testFunction error:',
        context,
      );
    });
  });
});
