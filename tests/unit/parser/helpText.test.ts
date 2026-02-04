import { describe, it, expect } from 'vitest';
import {
  getMainHelp,
  getSecurityHelp,
  getStyleHelp,
  getGenerateHelp,
  getValidateHelp,
  getCompareHelp,
  getCleanHelp,
  getInitHelp,
  getSecurityScanHelp,
  getIgnoreHelp,
} from '../../../src/cli/parser/helpText.js';

describe('helpText', () => {
  describe('getMainHelp', () => {
    it('should return help text with USAGE section', () => {
      const help = getMainHelp();
      expect(help).toContain('USAGE:');
      expect(help).toContain('stamp init');
      expect(help).toContain('stamp context');
      expect(help).toContain('stamp security');
    });

    it('should include OPTIONS section', () => {
      const help = getMainHelp();
      expect(help).toContain('OPTIONS:');
      expect(help).toContain('--version');
      expect(help).toContain('--help');
    });

    it('should include EXAMPLES section', () => {
      const help = getMainHelp();
      expect(help).toContain('EXAMPLES:');
    });

    it('should include all main commands', () => {
      const help = getMainHelp();
      expect(help).toContain('stamp init');
      expect(help).toContain('stamp context');
      expect(help).toContain('stamp context style');
      expect(help).toContain('stamp context validate');
      expect(help).toContain('stamp context compare');
      expect(help).toContain('stamp context clean');
      expect(help).toContain('stamp ignore');
      expect(help).toContain('stamp security scan');
      expect(help).toContain('stamp security --hard-reset');
    });
  });

  describe('getSecurityHelp', () => {
    it('should return security help text', () => {
      const help = getSecurityHelp();
      expect(help).toContain('Stamp Security');
      expect(help).toContain('USAGE:');
      expect(help).toContain('stamp security scan');
      expect(help).toContain('stamp security --hard-reset');
    });

    it('should include COMMANDS section', () => {
      const help = getSecurityHelp();
      expect(help).toContain('COMMANDS:');
      expect(help).toContain('scan');
      expect(help).toContain('--hard-reset');
    });

    it('should include OPTIONS section', () => {
      const help = getSecurityHelp();
      expect(help).toContain('OPTIONS:');
      expect(help).toContain('--out');
      expect(help).toContain('--force');
      expect(help).toContain('--quiet');
    });
  });

  describe('getStyleHelp', () => {
    it('should return style help text', () => {
      const help = getStyleHelp();
      expect(help).toContain('Stamp Context Style');
      expect(help).toContain('USAGE:');
      expect(help).toContain('stamp context style');
    });

    it('should include STYLE METADATA EXTRACTED section', () => {
      const help = getStyleHelp();
      expect(help).toContain('STYLE METADATA EXTRACTED:');
      expect(help).toContain('Tailwind');
      expect(help).toContain('SCSS');
    });

    it('should include style-related options', () => {
      const help = getStyleHelp();
      expect(help).toContain('--watch');
      expect(help).toContain('--debug');
      expect(help).toContain('--strict-watch');
    });
  });

  describe('getGenerateHelp', () => {
    it('should return generate help text', () => {
      const help = getGenerateHelp();
      expect(help).toContain('Stamp Context');
      expect(help).toContain('USAGE:');
      expect(help).toContain('stamp context');
    });

    it('should include all context options', () => {
      const help = getGenerateHelp();
      expect(help).toContain('--depth');
      expect(help).toContain('--include-code');
      expect(help).toContain('--include-style');
      expect(help).toContain('--format');
      expect(help).toContain('--watch');
      expect(help).toContain('--compare-modes');
    });

    it('should include EXAMPLES section', () => {
      const help = getGenerateHelp();
      expect(help).toContain('EXAMPLES:');
    });
  });

  describe('getValidateHelp', () => {
    it('should return validate help text', () => {
      const help = getValidateHelp();
      expect(help).toContain('Stamp Context Validate');
      expect(help).toContain('USAGE:');
      expect(help).toContain('stamp context validate');
    });

    it('should include ARGUMENTS section', () => {
      const help = getValidateHelp();
      expect(help).toContain('ARGUMENTS:');
      expect(help).toContain('[file]');
    });

    it('should include NOTES section', () => {
      const help = getValidateHelp();
      expect(help).toContain('NOTES:');
      expect(help).toContain('Exits with code 0 on success');
    });
  });

  describe('getCompareHelp', () => {
    it('should return compare help text', () => {
      const help = getCompareHelp();
      expect(help).toContain('Stamp Context Compare');
      expect(help).toContain('USAGE:');
      expect(help).toContain('stamp context compare');
    });

    it('should include COMPARISON MODES section', () => {
      const help = getCompareHelp();
      expect(help).toContain('COMPARISON MODES:');
      expect(help).toContain('Auto-Mode');
      expect(help).toContain('Single-File Mode');
    });

    it('should include EXIT CODES section', () => {
      const help = getCompareHelp();
      expect(help).toContain('EXIT CODES:');
      expect(help).toContain('0');
      expect(help).toContain('1');
    });

    it('should include DRIFT INDICATORS section', () => {
      const help = getCompareHelp();
      expect(help).toContain('DRIFT INDICATORS:');
      expect(help).toContain('ADDED FILE');
      expect(help).toContain('ORPHANED FILE');
      expect(help).toContain('DRIFT');
      expect(help).toContain('PASS');
    });
  });

  describe('getCleanHelp', () => {
    it('should return clean help text', () => {
      const help = getCleanHelp();
      expect(help).toContain('Stamp Context Clean');
      expect(help).toContain('USAGE:');
      expect(help).toContain('stamp context clean');
    });

    it('should include BEHAVIOR section', () => {
      const help = getCleanHelp();
      expect(help).toContain('BEHAVIOR:');
      expect(help).toContain('dry run');
    });

    it('should include FILES REMOVED section', () => {
      const help = getCleanHelp();
      expect(help).toContain('FILES REMOVED:');
      expect(help).toContain('context_main.json');
      expect(help).toContain('context.json');
      expect(help).toContain('.logicstamp/');
    });
  });

  describe('getInitHelp', () => {
    it('should return init help text', () => {
      const help = getInitHelp();
      expect(help).toContain('Stamp Init');
      expect(help).toContain('USAGE:');
      expect(help).toContain('stamp init');
    });

    it('should include WHAT IT DOES section', () => {
      const help = getInitHelp();
      expect(help).toContain('WHAT IT DOES:');
      expect(help).toContain('.gitignore');
    });

    it('should include NOTES section', () => {
      const help = getInitHelp();
      expect(help).toContain('NOTES:');
      expect(help).toContain('idempotent');
    });
  });

  describe('getSecurityScanHelp', () => {
    it('should return security scan help text', () => {
      const help = getSecurityScanHelp();
      expect(help).toContain('Stamp Security Scan');
      expect(help).toContain('USAGE:');
      expect(help).toContain('stamp security scan');
    });

    it('should include WHAT IT DOES section', () => {
      const help = getSecurityScanHelp();
      expect(help).toContain('WHAT IT DOES:');
      expect(help).toContain('API keys');
      expect(help).toContain('secrets');
    });

    it('should include OUTPUT section', () => {
      const help = getSecurityScanHelp();
      expect(help).toContain('OUTPUT:');
      expect(help).toContain('stamp_security_report.json');
    });
  });

  describe('getIgnoreHelp', () => {
    it('should return ignore help text', () => {
      const help = getIgnoreHelp();
      expect(help).toContain('Stamp Ignore');
      expect(help).toContain('USAGE:');
      expect(help).toContain('stamp ignore');
    });

    it('should include WHAT IT DOES section', () => {
      const help = getIgnoreHelp();
      expect(help).toContain('WHAT IT DOES:');
      expect(help).toContain('.stampignore');
    });

    it('should include NOTES section', () => {
      const help = getIgnoreHelp();
      expect(help).toContain('NOTES:');
      expect(help).toContain('glob patterns');
    });
  });

  describe('help text consistency', () => {
    it('should return non-empty strings for all help functions', () => {
      expect(getMainHelp().length).toBeGreaterThan(0);
      expect(getSecurityHelp().length).toBeGreaterThan(0);
      expect(getStyleHelp().length).toBeGreaterThan(0);
      expect(getGenerateHelp().length).toBeGreaterThan(0);
      expect(getValidateHelp().length).toBeGreaterThan(0);
      expect(getCompareHelp().length).toBeGreaterThan(0);
      expect(getCleanHelp().length).toBeGreaterThan(0);
      expect(getInitHelp().length).toBeGreaterThan(0);
      expect(getSecurityScanHelp().length).toBeGreaterThan(0);
      expect(getIgnoreHelp().length).toBeGreaterThan(0);
    });

    it('should all include USAGE section', () => {
      expect(getMainHelp()).toContain('USAGE:');
      expect(getSecurityHelp()).toContain('USAGE:');
      expect(getStyleHelp()).toContain('USAGE:');
      expect(getGenerateHelp()).toContain('USAGE:');
      expect(getValidateHelp()).toContain('USAGE:');
      expect(getCompareHelp()).toContain('USAGE:');
      expect(getCleanHelp()).toContain('USAGE:');
      expect(getInitHelp()).toContain('USAGE:');
      expect(getSecurityScanHelp()).toContain('USAGE:');
      expect(getIgnoreHelp()).toContain('USAGE:');
    });
  });
});
