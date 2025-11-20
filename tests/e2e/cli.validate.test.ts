import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, rm, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const execAsync = promisify(exec);

describe('CLI Validate Command Tests', () => {
  const fixturesPath = join(process.cwd(), 'tests/fixtures/simple-app');
  const outputPath = join(process.cwd(), 'tests/e2e/output');

  beforeEach(async () => {
    // Clean up any existing output files
    try {
      await rm(outputPath, { recursive: true, force: true });
    } catch (error) {
      // Directory doesn't exist, which is fine
    }
    // Recreate the output directory for tests
    await mkdir(outputPath, { recursive: true });
  });

  afterEach(async () => {
    // Clean up output files after tests
    try {
      await rm(outputPath, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Valid context files', () => {
    it('should validate a valid context.json file successfully', async () => {
      const outDir = join(outputPath, 'valid-context');

      await execAsync('npm run build');

      // Generate a valid context file
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --out ${outDir}`
      );

      // Get the first context file
      const index = JSON.parse(await readFile(join(outDir, 'context_main.json'), 'utf-8'));
      const contextFile = join(outDir, index.folders[0].contextFile);

      // Validate it
      const { stdout } = await execAsync(
        `node dist/cli/stamp.js context validate ${contextFile}`
      );

      expect(stdout).toContain('✅ Valid context file');
      expect(stdout).toContain('bundle(s)');
      expect(stdout).toContain('Total nodes:');
      expect(stdout).toContain('Total edges:');
    }, 30000);

    it('should validate context.json in current directory when no file specified (fallback mode)', async () => {
      const testDir = join(outputPath, 'validate-default');
      await mkdir(testDir, { recursive: true });

      await execAsync('npm run build');

      // Copy fixture files to test directory
      const { cpSync } = await import('node:fs');
      cpSync(fixturesPath, testDir, { recursive: true });

      // Generate context in the test directory
      await execAsync(
        `node "${join(process.cwd(), 'dist/cli/stamp.js')}" context .`,
        { cwd: testDir }
      );

      // Get the context file
      const index = JSON.parse(await readFile(join(testDir, 'context_main.json'), 'utf-8'));
      const contextFile = join(testDir, index.folders[0].contextFile);
      const contextContent = await readFile(contextFile, 'utf-8');

      // Copy it to context.json in the test directory
      await writeFile(join(testDir, 'context.json'), contextContent);

      // Delete context_main.json to test fallback to single-file mode
      await rm(join(testDir, 'context_main.json'));

      // Validate without specifying file (should fall back to context.json)
      const { stdout } = await execAsync(
        `node "${join(process.cwd(), 'dist/cli/stamp.js')}" context validate`,
        { cwd: testDir }
      );

      expect(stdout).toContain('context_main.json not found, falling back to single-file mode');
      expect(stdout).toContain('✅ Valid context file');
    }, 30000);

    it('should work with standalone validate command', async () => {
      const outDir = join(outputPath, 'standalone-validate');

      await execAsync('npm run build');

      // Generate a valid context file
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --out ${outDir}`
      );

      // Get the first context file
      const index = JSON.parse(await readFile(join(outDir, 'context_main.json'), 'utf-8'));
      const contextFile = join(outDir, index.folders[0].contextFile);

      // Validate using standalone command
      const { stdout } = await execAsync(
        `node dist/cli/validate-index.js ${contextFile}`
      );

      expect(stdout).toContain('✅ Valid context file');
    }, 30000);
  });

  describe('Multi-file validation mode', () => {
    it('should validate all context files when no file specified (multi-file mode)', async () => {
      const testDir = join(outputPath, 'validate-multifile');
      await mkdir(testDir, { recursive: true });

      await execAsync('npm run build');

      // Copy fixture files to test directory
      const { cpSync } = await import('node:fs');
      cpSync(fixturesPath, testDir, { recursive: true });

      // Generate context in the test directory (creates context_main.json + folder context files)
      await execAsync(
        `node "${join(process.cwd(), 'dist/cli/stamp.js')}" context .`,
        { cwd: testDir }
      );

      // Validate without specifying file (should use multi-file mode)
      const { stdout } = await execAsync(
        `node "${join(process.cwd(), 'dist/cli/stamp.js')}" context validate`,
        { cwd: testDir }
      );

      expect(stdout).toContain('🔍 Validating all context files using');
      expect(stdout).toContain('context_main.json');
      expect(stdout).toContain('✅ All context files are valid');
      expect(stdout).toContain('📁 Validation Summary:');
      expect(stdout).toContain('Total folders:');
      expect(stdout).toContain('✅ Valid:');
      expect(stdout).toContain('Total nodes:');
      expect(stdout).toContain('Total edges:');
      expect(stdout).toContain('📂 Folder Details:');
    }, 30000);

    it('should detect and report invalid folder in multi-file mode', async () => {
      const testDir = join(outputPath, 'validate-multifile-invalid');
      await mkdir(testDir, { recursive: true });

      await execAsync('npm run build');

      // Copy fixture files to test directory
      const { cpSync } = await import('node:fs');
      cpSync(fixturesPath, testDir, { recursive: true });

      // Generate context in the test directory
      await execAsync(
        `node "${join(process.cwd(), 'dist/cli/stamp.js')}" context .`,
        { cwd: testDir }
      );

      // Corrupt one of the context files
      const index = JSON.parse(await readFile(join(testDir, 'context_main.json'), 'utf-8'));
      const contextFile = join(testDir, index.folders[0].contextFile);
      await writeFile(contextFile, JSON.stringify([{
        type: 'WrongType',
        schemaVersion: '0.1',
        entryId: 'test.tsx',
        graph: { nodes: [], edges: [] },
        meta: { missing: [], source: 'test' }
      }]));

      // Validate (should fail)
      try {
        await execAsync(
          `node "${join(process.cwd(), 'dist/cli/stamp.js')}" context validate`,
          { cwd: testDir }
        );
        expect.fail('Should have failed validation');
      } catch (error: any) {
        expect(error.code).toBe(1);
        const output = (error.stderr || error.stdout || error.message || '').toString();
        expect(output).toContain('❌ Validation failed');
        expect(output).toContain('❌ Invalid:');
        expect(output).toContain('❌ INVALID:');
      }
    }, 30000);

    it('should detect missing context files in multi-file mode', async () => {
      const testDir = join(outputPath, 'validate-multifile-missing');
      await mkdir(testDir, { recursive: true });

      await execAsync('npm run build');

      // Copy fixture files to test directory
      const { cpSync } = await import('node:fs');
      cpSync(fixturesPath, testDir, { recursive: true });

      // Generate context in the test directory
      await execAsync(
        `node "${join(process.cwd(), 'dist/cli/stamp.js')}" context .`,
        { cwd: testDir }
      );

      // Delete one of the context files (but keep it in the index)
      const index = JSON.parse(await readFile(join(testDir, 'context_main.json'), 'utf-8'));
      const contextFile = join(testDir, index.folders[0].contextFile);
      await rm(contextFile);

      // Validate (should fail)
      try {
        await execAsync(
          `node "${join(process.cwd(), 'dist/cli/stamp.js')}" context validate`,
          { cwd: testDir }
        );
        expect.fail('Should have failed validation');
      } catch (error: any) {
        expect(error.code).toBe(1);
        const output = (error.stderr || error.stdout || error.message || '').toString();
        expect(output).toContain('❌ Validation failed');
        expect(output).toContain('❌ Invalid:');
      }
    }, 30000);

    it('should validate specific file when explicitly provided (single-file mode with context_main.json present)', async () => {
      const testDir = join(outputPath, 'validate-explicit-file');
      await mkdir(testDir, { recursive: true });

      await execAsync('npm run build');

      // Copy fixture files to test directory
      const { cpSync } = await import('node:fs');
      cpSync(fixturesPath, testDir, { recursive: true });

      // Generate context in the test directory
      await execAsync(
        `node "${join(process.cwd(), 'dist/cli/stamp.js')}" context .`,
        { cwd: testDir }
      );

      // Get one specific context file
      const index = JSON.parse(await readFile(join(testDir, 'context_main.json'), 'utf-8'));
      const contextFile = index.folders[0].contextFile;

      // Validate specific file (should use single-file mode, NOT multi-file mode)
      const { stdout } = await execAsync(
        `node "${join(process.cwd(), 'dist/cli/stamp.js')}" context validate ${contextFile}`,
        { cwd: testDir }
      );

      // Should NOT show multi-file mode output
      expect(stdout).not.toContain('🔍 Validating all context files');
      expect(stdout).not.toContain('📁 Validation Summary:');

      // Should show single-file mode output
      expect(stdout).toContain('✅ Valid context file');
      expect(stdout).toContain('bundle(s)');
    }, 30000);

    it('should report comprehensive statistics in multi-file mode', async () => {
      const testDir = join(outputPath, 'validate-multifile-stats');
      await mkdir(testDir, { recursive: true });

      await execAsync('npm run build');

      // Copy fixture files to test directory
      const { cpSync } = await import('node:fs');
      cpSync(fixturesPath, testDir, { recursive: true });

      // Generate context in the test directory
      await execAsync(
        `node "${join(process.cwd(), 'dist/cli/stamp.js')}" context .`,
        { cwd: testDir }
      );

      // Validate
      const { stdout } = await execAsync(
        `node "${join(process.cwd(), 'dist/cli/stamp.js')}" context validate`,
        { cwd: testDir }
      );

      // Check for comprehensive statistics
      expect(stdout).toContain('Total folders:');
      expect(stdout).toContain('✅ Valid:');
      expect(stdout).toContain('Total errors: 0');
      expect(stdout).toContain('Total warnings: 0');
      expect(stdout).toContain('Total nodes:');
      expect(stdout).toContain('Total edges:');

      // Check for per-folder details
      expect(stdout).toContain('✅ VALID:');
      expect(stdout).toContain('Path:');
      expect(stdout).toContain('Bundles:');
    }, 30000);
  });

  describe('Invalid bundle structures', () => {
    it('should reject non-array input', async () => {
      const invalidFile = join(outputPath, 'invalid-not-array.json');
      await writeFile(invalidFile, JSON.stringify({ type: 'not-an-array' }));

      await execAsync('npm run build');

      try {
        await execAsync(
          `node dist/cli/stamp.js context validate ${invalidFile}`
        );
        expect.fail('Should have failed validation');
      } catch (error: any) {
        expect(error.code).toBe(1);
        const output = (error.stderr || error.stdout || error.message || '').toString();
        expect(output).toContain('Invalid format: expected array of bundles');
      }
    }, 30000);

    it('should reject bundle with wrong type', async () => {
      const invalidFile = join(outputPath, 'invalid-type.json');
      await writeFile(invalidFile, JSON.stringify([{
        type: 'WrongType',
        schemaVersion: '0.1',
        entryId: 'test.tsx',
        graph: { nodes: [], edges: [] },
        meta: { missing: [], source: 'test' }
      }]));

      await execAsync('npm run build');

      try {
        await execAsync(
          `node dist/cli/stamp.js context validate ${invalidFile}`
        );
        expect.fail('Should have failed validation');
      } catch (error: any) {
        expect(error.code).toBe(1);
        const output = (error.stderr || error.stdout || error.message || '').toString();
        expect(output).toContain("Invalid type (expected 'LogicStampBundle'");
      }
    }, 30000);

    it('should reject bundle with wrong schemaVersion', async () => {
      const invalidFile = join(outputPath, 'invalid-schema.json');
      await writeFile(invalidFile, JSON.stringify([{
        type: 'LogicStampBundle',
        schemaVersion: '0.2',
        entryId: 'test.tsx',
        graph: { nodes: [], edges: [] },
        meta: { missing: [], source: 'test' }
      }]));

      await execAsync('npm run build');

      try {
        await execAsync(
          `node dist/cli/stamp.js context validate ${invalidFile}`
        );
        expect.fail('Should have failed validation');
      } catch (error: any) {
        expect(error.code).toBe(1);
        const output = (error.stderr || error.stdout || error.message || '').toString();
        expect(output).toContain("Invalid schemaVersion (expected '0.1'");
      }
    }, 30000);

    it('should reject bundle with missing entryId', async () => {
      const invalidFile = join(outputPath, 'missing-entryid.json');
      await writeFile(invalidFile, JSON.stringify([{
        type: 'LogicStampBundle',
        schemaVersion: '0.1',
        graph: { nodes: [], edges: [] },
        meta: { missing: [], source: 'test' }
      }]));

      await execAsync('npm run build');

      try {
        await execAsync(
          `node dist/cli/stamp.js context validate ${invalidFile}`
        );
        expect.fail('Should have failed validation');
      } catch (error: any) {
        expect(error.code).toBe(1);
        const output = (error.stderr || error.stdout || error.message || '').toString();
        expect(output).toContain('Missing entryId');
      }
    }, 30000);

    it('should reject bundle with invalid graph structure', async () => {
      const invalidFile = join(outputPath, 'invalid-graph.json');
      await writeFile(invalidFile, JSON.stringify([{
        type: 'LogicStampBundle',
        schemaVersion: '0.1',
        entryId: 'test.tsx',
        graph: { nodes: 'not-an-array', edges: [] },
        meta: { missing: [], source: 'test' }
      }]));

      await execAsync('npm run build');

      try {
        await execAsync(
          `node dist/cli/stamp.js context validate ${invalidFile}`
        );
        expect.fail('Should have failed validation');
      } catch (error: any) {
        expect(error.code).toBe(1);
        const output = (error.stderr || error.stdout || error.message || '').toString();
        expect(output).toContain('Invalid graph structure');
      }
    }, 30000);

    it('should reject bundle with missing graph', async () => {
      const invalidFile = join(outputPath, 'missing-graph.json');
      await writeFile(invalidFile, JSON.stringify([{
        type: 'LogicStampBundle',
        schemaVersion: '0.1',
        entryId: 'test.tsx',
        meta: { missing: [], source: 'test' }
      }]));

      await execAsync('npm run build');

      try {
        await execAsync(
          `node dist/cli/stamp.js context validate ${invalidFile}`
        );
        expect.fail('Should have failed validation');
      } catch (error: any) {
        expect(error.code).toBe(1);
        const output = (error.stderr || error.stdout || error.message || '').toString();
        expect(output).toContain('Invalid graph structure');
      }
    }, 30000);

    it('should reject bundle with invalid meta structure', async () => {
      const invalidFile = join(outputPath, 'invalid-meta.json');
      await writeFile(invalidFile, JSON.stringify([{
        type: 'LogicStampBundle',
        schemaVersion: '0.1',
        entryId: 'test.tsx',
        graph: { nodes: [], edges: [] },
        meta: { missing: 'not-an-array' }
      }]));

      await execAsync('npm run build');

      try {
        await execAsync(
          `node dist/cli/stamp.js context validate ${invalidFile}`
        );
        expect.fail('Should have failed validation');
      } catch (error: any) {
        expect(error.code).toBe(1);
        const output = (error.stderr || error.stdout || error.message || '').toString();
        expect(output).toContain('Invalid meta structure');
      }
    }, 30000);

    it('should reject bundle with missing meta', async () => {
      const invalidFile = join(outputPath, 'missing-meta.json');
      await writeFile(invalidFile, JSON.stringify([{
        type: 'LogicStampBundle',
        schemaVersion: '0.1',
        entryId: 'test.tsx',
        graph: { nodes: [], edges: [] }
      }]));

      await execAsync('npm run build');

      try {
        await execAsync(
          `node dist/cli/stamp.js context validate ${invalidFile}`
        );
        expect.fail('Should have failed validation');
      } catch (error: any) {
        expect(error.code).toBe(1);
        const output = (error.stderr || error.stdout || error.message || '').toString();
        expect(output).toContain('Invalid meta structure');
      }
    }, 30000);
  });

  describe('Invalid contract types', () => {
    it('should reject node with invalid contract type', async () => {
      const invalidFile = join(outputPath, 'invalid-contract-type.json');
      await writeFile(invalidFile, JSON.stringify([{
        type: 'LogicStampBundle',
        schemaVersion: '0.1',
        entryId: 'test.tsx',
        graph: {
          nodes: [{
            entryId: 'test.tsx',
            contract: {
              type: 'WrongContractType',
              schemaVersion: '0.3'
            }
          }],
          edges: []
        },
        meta: { missing: [], source: 'test' }
      }]));

      await execAsync('npm run build');

      try {
        await execAsync(
          `node dist/cli/stamp.js context validate ${invalidFile}`
        );
        expect.fail('Should have failed validation');
      } catch (error: any) {
        expect(error.code).toBe(1);
        const output = (error.stderr || error.stdout || error.message || '').toString();
        expect(output).toContain('has invalid contract type');
      }
    }, 30000);

    it('should warn about unexpected contract schemaVersion', async () => {
      const warningFile = join(outputPath, 'contract-version-warning.json');
      await writeFile(warningFile, JSON.stringify([{
        type: 'LogicStampBundle',
        schemaVersion: '0.1',
        entryId: 'test.tsx',
        graph: {
          nodes: [{
            entryId: 'test.tsx',
            contract: {
              type: 'UIFContract',
              schemaVersion: '0.2'
            }
          }],
          edges: []
        },
        meta: { missing: [], source: 'test' }
      }]));

      await execAsync('npm run build');

      const { stdout, stderr } = await execAsync(
        `node dist/cli/stamp.js context validate ${warningFile}`
      );

      const output = (stdout + stderr).toString();
      expect(output).toContain('⚠️');
      expect(output).toContain('unexpected contract version');
      expect(output).toContain('✅ Valid with');
      expect(output).toContain('warning(s)');
    }, 30000);
  });

  describe('Hash format validation', () => {
    it('should warn about invalid bundleHash format', async () => {
      const warningFile = join(outputPath, 'invalid-hash.json');
      await writeFile(warningFile, JSON.stringify([{
        type: 'LogicStampBundle',
        schemaVersion: '0.1',
        entryId: 'test.tsx',
        bundleHash: 'invalid-hash-format',
        graph: { nodes: [], edges: [] },
        meta: { missing: [], source: 'test' }
      }]));

      await execAsync('npm run build');

      const { stdout, stderr } = await execAsync(
        `node dist/cli/stamp.js context validate ${warningFile}`
      );

      const output = (stdout + stderr).toString();
      expect(output).toContain('⚠️');
      expect(output).toContain('bundleHash has unexpected format');
      expect(output).toContain('✅ Valid with');
      expect(output).toContain('warning(s)');
    }, 30000);

    it('should accept valid bundleHash format', async () => {
      const validFile = join(outputPath, 'valid-hash.json');
      await writeFile(validFile, JSON.stringify([{
        type: 'LogicStampBundle',
        schemaVersion: '0.1',
        entryId: 'test.tsx',
        bundleHash: 'uifb:123456789012345678901234',
        graph: { nodes: [], edges: [] },
        meta: { missing: [], source: 'test' }
      }]));

      await execAsync('npm run build');

      const { stdout } = await execAsync(
        `node dist/cli/stamp.js context validate ${validFile}`
      );

      expect(stdout).toContain('✅ Valid context file');
      expect(stdout).not.toContain('⚠️');
    }, 30000);
  });

  describe('Error handling', () => {
    it('should handle file not found error', async () => {
      await execAsync('npm run build');

      try {
        await execAsync(
          'node dist/cli/stamp.js context validate /non/existent/path.json'
        );
        expect.fail('Should have failed');
      } catch (error: any) {
        expect(error.code).toBe(1);
        const output = (error.stderr || error.stdout || error.message || '').toString();
        expect(output).toContain('File not found');
      }
    }, 30000);

    it('should handle invalid JSON syntax', async () => {
      const invalidJsonFile = join(outputPath, 'invalid-json.json');
      await writeFile(invalidJsonFile, '{ invalid json }');

      await execAsync('npm run build');

      try {
        await execAsync(
          `node dist/cli/stamp.js context validate ${invalidJsonFile}`
        );
        expect.fail('Should have failed');
      } catch (error: any) {
        expect(error.code).toBe(1);
        const output = (error.stderr || error.stdout || error.message || '').toString();
        expect(output).toContain('Invalid JSON');
      }
    }, 30000);

    it('should provide helpful message when context.json not found in current directory', async () => {
      const testDir = join(outputPath, 'no-context');
      await mkdir(testDir, { recursive: true });

      await execAsync('npm run build');

      try {
        await execAsync(
          `node "${join(process.cwd(), 'dist/cli/stamp.js')}" context validate`,
          { cwd: testDir }
        );
        expect.fail('Should have failed');
      } catch (error: any) {
        expect(error.code).toBe(1);
        const output = (error.stderr || error.stdout || error.message || '').toString();
        expect(output).toContain('File not found');
        expect(output).toContain('Tip:');
      }
    }, 30000);
  });

  describe('Multiple bundles', () => {
    it('should validate multiple bundles correctly', async () => {
      const multiBundleFile = join(outputPath, 'multi-bundle.json');
      await writeFile(multiBundleFile, JSON.stringify([
        {
          type: 'LogicStampBundle',
          schemaVersion: '0.1',
          entryId: 'test1.tsx',
          graph: { nodes: [], edges: [] },
          meta: { missing: [], source: 'test' }
        },
        {
          type: 'LogicStampBundle',
          schemaVersion: '0.1',
          entryId: 'test2.tsx',
          graph: { nodes: [], edges: [] },
          meta: { missing: [], source: 'test' }
        }
      ]));

      await execAsync('npm run build');

      const { stdout } = await execAsync(
        `node dist/cli/stamp.js context validate ${multiBundleFile}`
      );

      expect(stdout).toContain('✅ Valid context file');
      expect(stdout).toContain('2 bundle(s)');
    }, 30000);

    it('should report errors for multiple invalid bundles', async () => {
      const multiInvalidFile = join(outputPath, 'multi-invalid.json');
      await writeFile(multiInvalidFile, JSON.stringify([
        {
          type: 'WrongType',
          schemaVersion: '0.1',
          entryId: 'test1.tsx',
          graph: { nodes: [], edges: [] },
          meta: { missing: [], source: 'test' }
        },
        {
          type: 'LogicStampBundle',
          schemaVersion: '0.2',
          entryId: 'test2.tsx',
          graph: { nodes: [], edges: [] },
          meta: { missing: [], source: 'test' }
        }
      ]));

      await execAsync('npm run build');

      try {
        await execAsync(
          `node dist/cli/stamp.js context validate ${multiInvalidFile}`
        );
        expect.fail('Should have failed validation');
      } catch (error: any) {
        expect(error.code).toBe(1);
        const output = (error.stderr || error.stdout || error.message || '').toString();
        expect(output).toContain('Bundle 1');
        expect(output).toContain('Bundle 2');
        expect(output).toContain('error(s)');
      }
    }, 30000);
  });

  describe('Statistics reporting', () => {
    it('should report correct node and edge counts', async () => {
      const statsFile = join(outputPath, 'stats-test.json');
      await writeFile(statsFile, JSON.stringify([{
        type: 'LogicStampBundle',
        schemaVersion: '0.1',
        entryId: 'test.tsx',
        graph: {
          nodes: [
            { entryId: 'node1.tsx', contract: { type: 'UIFContract', schemaVersion: '0.3' } },
            { entryId: 'node2.tsx', contract: { type: 'UIFContract', schemaVersion: '0.3' } }
          ],
          edges: [
            ['node1.tsx', 'node2.tsx']
          ]
        },
        meta: { missing: [], source: 'test' }
      }]));

      await execAsync('npm run build');

      const { stdout } = await execAsync(
        `node dist/cli/stamp.js context validate ${statsFile}`
      );

      expect(stdout).toContain('Total nodes: 2');
      expect(stdout).toContain('Total edges: 1');
    }, 30000);
  });

  describe('Help command', () => {
    it('should display help for validate command', async () => {
      await execAsync('npm run build');

      const { stdout } = await execAsync(
        'node dist/cli/stamp.js context validate --help'
      );

      expect(stdout).toContain('Stamp Context Validate');
      expect(stdout).toContain('USAGE:');
      expect(stdout).toContain('stamp context validate');
      expect(stdout).toContain('EXAMPLES:');
    }, 30000);
  });
});

